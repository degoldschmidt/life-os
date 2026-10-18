import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { addDaysToKey, parsePeriodId, periodFor, todayKey, type DayKey } from "@/lib/dates";
import { captureForUser } from "@/lib/services/capture";
import { getSettingsFor, type Settings } from "@/lib/services/settings";
import { listAreas, areaIdByCode } from "@/lib/services/areas";
import * as tasksSvc from "@/lib/services/tasks";
import { listHabitStatuses, setHabitDone } from "@/lib/services/habits";
import { addInterstitial, getMorningIntention, listDayEntries } from "@/lib/services/journal";
import { areaOverview, createProject, projectArea, updateGoalProgress } from "@/lib/services/goals";
import { computePeriodStats } from "@/lib/services/stats";
import { getOrCreateReview, saveProgress } from "@/lib/services/reviews";
import { loadTrends } from "@/lib/services/trends";
import { addNote, searchAll } from "@/lib/services/notes";
import { listBlocks } from "@/lib/services/blocks";
import { listCalendarEvents } from "@/lib/services/calendar";

type Ctx = { userId: string; settings: Settings; today: DayKey };

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const fail = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const taskOut = (t: tasksSvc.TaskWithArea) => ({
  id: t.id,
  title: t.title,
  area: t.areaCode,
  status: t.status,
  when: t.when,
  rank: t.planRank,
  estimateMin: t.estimateMin,
  deadline: t.deadline,
  scheduledDate: t.scheduledDate,
  plannedFor: t.plannedForDate,
});

/** Match a habit by exact id or by case-insensitive name fragment; ambiguous names are an error. */
export function matchHabit<T extends { id: string; name: string }>(habits: T[], key: string): T | "ambiguous" | null {
  const exact = habits.find((h) => h.id === key);
  if (exact) return exact;
  const k = key.trim().toLowerCase();
  const byName = habits.filter((h) => h.name.toLowerCase() === k);
  if (byName.length === 1) return byName[0];
  const partial = habits.filter((h) => h.name.toLowerCase().includes(k));
  if (partial.length === 1) return partial[0];
  return partial.length > 1 || byName.length > 1 ? "ambiguous" : null;
}

/** All Life OS tools, bound to one user. Reads are annotated read-only so clients can auto-approve them. */
export function buildMcpServer(ctx: Ctx): McpServer {
  const { userId, settings, today } = ctx;
  const server = new McpServer({ name: "life-os", version: "1.0.0" });
  const read = { readOnlyHint: true } as const;

  server.registerTool("get_today", { title: "Today", description: "Today's plan: intention, Top 3, other tasks, done tasks, unfinished tasks from earlier days, habits due, calendar events and time blocks.", annotations: read, inputSchema: {} }, async () => {
    const [dayTasks, stale, habits, intention, events, blocks, inbox] = await Promise.all([
      tasksSvc.listDay(userId, today), tasksSvc.listStale(userId, today), listHabitStatuses(userId, today), getMorningIntention(userId, today),
      listCalendarEvents(userId, today, today, settings.tz), listBlocks(userId, today, today, settings.tz), tasksSvc.countInbox(userId),
    ]);
    const open = dayTasks.filter((t) => t.status === "todo");
    return text({
      date: today, intention,
      top3: open.filter((t) => t.planRank).sort((a, b) => a.planRank! - b.planRank!).map(taskOut),
      other: open.filter((t) => !t.planRank).map(taskOut),
      done: dayTasks.filter((t) => t.status === "done").map(taskOut),
      unfinishedFromEarlier: stale.map(taskOut), inboxCount: inbox,
      habits: habits.filter((h) => h.status.dueToday || h.status.doneToday).map((h) => ({ id: h.id, name: h.name, doneToday: h.status.doneToday, missedLastDue: h.status.missedLastDue })),
      calendar: events.filter((e) => !e.allDay).map((e) => ({ title: e.title, startMin: e.startMin, endMin: e.endMin })),
      blocks: blocks.map((b) => ({ title: b.title, kind: b.kind, startMin: b.startMin, endMin: b.endMin })),
    });
  });

  server.registerTool("list_tasks", { title: "List tasks", description: "Open tasks by scope: inbox, today, tomorrow, anytime (project next actions), someday, stale (unfinished from earlier days).", annotations: read, inputSchema: { scope: z.enum(["inbox", "today", "tomorrow", "anytime", "someday", "stale"]), limit: z.number().int().min(1).max(100).default(30) } }, async ({ scope, limit }) => {
    const rows =
      scope === "inbox" ? await tasksSvc.listInbox(userId)
      : scope === "today" ? (await tasksSvc.listDay(userId, today)).filter((t) => t.status === "todo")
      : scope === "tomorrow" ? (await tasksSvc.listDay(userId, addDaysToKey(today, 1, settings.tz))).filter((t) => t.status === "todo")
      : scope === "anytime" ? await tasksSvc.listAnytime(userId)
      : scope === "someday" ? await tasksSvc.listSomeday(userId)
      : await tasksSvc.listStale(userId, today);
    return text({ scope, count: rows.length, tasks: rows.slice(0, limit).map(taskOut) });
  });

  server.registerTool("create_task", { title: "Create task", description: "Add a task using quick-capture syntax: 'call mum tomorrow #REL ~20m', 'submit paper due 30 nov #WRK'. Lands in the Inbox unless a date or 'today' is given.", inputSchema: { text: z.string().min(1).max(500), today: z.boolean().default(false) } }, async ({ text: raw, today: forceToday }) => {
    const r = await captureForUser(userId, settings, raw, { forceToday });
    return r.ok ? text({ created: { id: r.id, title: r.title, placedIn: r.where } }) : fail(r.error);
  });

  server.registerTool("complete_task", { title: "Complete task", description: "Mark a task done, or reopen it with done=false.", inputSchema: { id: z.uuid(), done: z.boolean().default(true) } }, async ({ id, done }) => {
    await tasksSvc.setDone(userId, id, done);
    return text({ id, status: done ? "done" : "todo" });
  });

  server.registerTool("plan_task", { title: "Plan task", description: "Move a task: to today, tomorrow, a specific date, someday, or back to the inbox. Optionally rank it 1-3 in today's Top 3 (only with when=today).", inputSchema: { id: z.uuid(), when: z.enum(["today", "tomorrow", "date", "someday", "inbox"]), date: day.optional(), rank: z.number().int().min(1).max(3).optional() } }, async ({ id, when, date, rank }) => {
    if (when === "today") { await tasksSvc.planForToday(userId, id, today); if (rank) await tasksSvc.setTopRank(userId, id, rank, today); }
    else if (when === "tomorrow") await tasksSvc.scheduleFor(userId, id, addDaysToKey(today, 1, settings.tz));
    else if (when === "date") { if (!date) return fail("when=date needs a date"); await tasksSvc.scheduleFor(userId, id, date); }
    else if (when === "someday") await tasksSvc.moveToSomeday(userId, id);
    else await tasksSvc.moveToInbox(userId, id);
    return text({ id, moved: when, date: date ?? null, rank: when === "today" ? rank ?? null : null });
  });

  server.registerTool("list_habits", { title: "Habits", description: "Active habits with today's status and 14-day completion.", annotations: read, inputSchema: {} }, async () => {
    const habits = await listHabitStatuses(userId, today);
    return text(habits.map((h) => ({ id: h.id, name: h.name, area: h.areaCode, dueToday: h.status.dueToday, doneToday: h.status.doneToday, missedLastDue: h.status.missedLastDue, last14: `${h.status.doneInWindow}/${h.status.dueInWindow}` })));
  });

  server.registerTool("log_habit", { title: "Log habit", description: "Mark a habit done for a day (default today) or undo it. Identify it by name or id.", inputSchema: { habit: z.string().min(1), done: z.boolean().default(true), day: day.optional() } }, async ({ habit, done, day: d }) => {
    const m = matchHabit(await listHabitStatuses(userId, today), habit);
    if (m === null) return fail(`No habit matches "${habit}".`);
    if (m === "ambiguous") return fail(`"${habit}" matches several habits. Use the exact name or id.`);
    await setHabitDone(userId, m.id, d ?? today, done);
    return text({ habit: m.name, day: d ?? today, done });
  });

  server.registerTool("add_journal_entry", { title: "Journal entry", description: "Add a short timestamped line to today's journal.", inputSchema: { text: z.string().min(1).max(1000) } }, async ({ text: t }) => {
    await addInterstitial(userId, today, t);
    return text({ added: true, day: today });
  });

  server.registerTool("get_journal", { title: "Read journal", description: "All journal entries for a day (default today): intention, notes, day note, shutdown reflection, mood and energy.", annotations: read, inputSchema: { day: day.optional() } }, async ({ day: d }) => {
    const entries = await listDayEntries(userId, d ?? today);
    return text({ day: d ?? today, entries: entries.map((e) => ({ kind: e.kind, text: e.contentMd, mood: e.mood, energy: e.energy, at: e.createdAt })) });
  });

  const goalPeriods = () => [periodFor("quarter", today, settings.tz).id, periodFor("year", today, settings.tz).id];
  const week = () => periodFor("week", today, settings.tz);

  server.registerTool("list_goals", { title: "Goals and projects", description: "Areas with their standards, current goals (key results, confidence) and active projects with next actions.", annotations: read, inputSchema: {} }, async () => {
    const o = await areaOverview(userId, goalPeriods(), week().start, week().end);
    return text(o.map((a) => ({
      area: a.area.code, name: a.area.name, standard: a.area.standard, weeklyTargetHours: a.area.weeklyTargetHours,
      goals: a.goals.map((g) => ({ id: g.id, title: g.title, period: g.period, status: g.status, confidence: g.confidence, keyResults: g.keyResults.map((k, i) => ({ index: i, metric: k.metric, current: k.current, target: k.target, unit: k.unit })) })),
      projects: a.projects.map((p) => ({ id: p.id, title: p.title, status: p.status, nextAction: p.nextAction, openTasks: p.openTasks })),
    })));
  });

  server.registerTool("update_key_result", { title: "Update key result", description: "Set the current value of a goal's key result (index from list_goals).", inputSchema: { goalId: z.uuid(), krIndex: z.number().int().min(0).max(2), current: z.number(), confidence: z.number().int().min(1).max(10).optional() } }, async ({ goalId, krIndex, current, confidence }) => {
    const currents: (number | null)[] = [null, null, null];
    currents[krIndex] = current;
    await updateGoalProgress(userId, goalId, { currents, confidence });
    return text({ goalId, krIndex, current });
  });

  server.registerTool("add_project", { title: "Add project", description: "Create a project in an area (code WRK, HLT, REL or FIN).", inputSchema: { area: z.string().length(3), title: z.string().min(1).max(200), goalId: z.uuid().optional(), deadline: day.optional() } }, async ({ area, title, goalId, deadline }) => {
    const areaId = await areaIdByCode(userId, area);
    if (!areaId) return fail(`Unknown area ${area}.`);
    const id = await createProject(userId, { areaId, title, goalId: goalId ?? null, deadline: deadline ?? null });
    return text({ created: { id, title, area: area.toUpperCase() } });
  });

  server.registerTool("add_next_action", { title: "Add next action", description: "Add a task as a project's next action. It waits as 'anytime' until planned.", inputSchema: { projectId: z.uuid(), title: z.string().min(1).max(300) } }, async ({ projectId, title }) => {
    const areaId = await projectArea(userId, projectId);
    if (!areaId) return fail("Project not found.");
    const t = await tasksSvc.createTask(userId, { title, areaId, projectId, plan: { kind: "anytime" } });
    return text({ created: { id: t.id, title } });
  });

  server.registerTool("get_review_context", { title: "Review context", description: "The facts for a period: planned vs done, deep work, habits, attention per area vs target, mood, projects without a next action, goal progress. type is week, month, quarter or year; period defaults to the current one (ids like 2026-W42, 2026-10, 2026-Q4, 2026).", annotations: read, inputSchema: { type: z.enum(["week", "month", "quarter", "year"]), period: z.string().optional() } }, async ({ type, period }) => {
    const p = period ? parsePeriodId(period, settings.tz) : periodFor(type, today, settings.tz);
    if (!p || p.type !== type) return fail(`"${period}" is not a valid ${type} period id.`);
    const stats = await computePeriodStats(userId, p, settings.tz, [periodFor("quarter", p.start, settings.tz).id, periodFor("year", p.start, settings.tz).id]);
    return text(stats);
  });

  server.registerTool("save_review_draft", { title: "Save review draft", description: "Write draft answers into a review without finishing it, so the person can edit them in the app. answers maps question ids (from the review template, e.g. wins, off_course, drained, joy, imbalance for the weekly review) to text.", inputSchema: { type: z.enum(["week", "month", "quarter", "year"]), period: z.string().optional(), answers: z.record(z.string(), z.string().max(4000)) } }, async ({ type, period, answers }) => {
    const p = period ? parsePeriodId(period, settings.tz) : periodFor(type, today, settings.tz);
    if (!p || p.type !== type) return fail(`"${period}" is not a valid ${type} period id.`);
    const { review, template } = await getOrCreateReview(userId, type, p);
    if (review.status === "final") return fail("That review is already finished. Reopen it in the app first.");
    const known = new Set(template.steps.flatMap((s) => s.questions.map((q) => q.id)));
    const unknown = Object.keys(answers).filter((k) => !known.has(k));
    // Never overwrite something the person already wrote.
    const mine = review.answers as Record<string, unknown>;
    const merged = Object.fromEntries(Object.entries(answers).filter(([k]) => known.has(k) && !(typeof mine[k] === "string" && (mine[k] as string).trim())));
    await saveProgress(userId, review.id, { answers: merged });
    return text({ review: p.id, saved: Object.keys(merged), skippedBecauseAlreadyWritten: Object.keys(answers).filter((k) => known.has(k) && !(k in merged)), unknownQuestionIds: unknown });
  });

  server.registerTool("get_trend", { title: "Trends", description: "Weekly series from finished reviews: planned vs done %, deep-work hours, habit %, mood, energy, and hours per area.", annotations: read, inputSchema: { weeks: z.number().int().min(1).max(52).default(12) } }, async ({ weeks }) => text((await loadTrends(userId, weeks)).weeks));

  server.registerTool("search", { title: "Search", description: "Search task titles, notes and journal text (case-insensitive).", annotations: read, inputSchema: { query: z.string().min(2).max(100), limit: z.number().int().min(1).max(50).default(15) } }, async ({ query, limit }) => text(await searchAll(userId, query, limit)));

  server.registerTool("add_note", { title: "Add note", description: "Save a note (title and Markdown body), optionally tagged to an area.", inputSchema: { title: z.string().min(1).max(200), content: z.string().max(50000), area: z.string().length(3).optional() } }, async ({ title, content, area }) => {
    const areaId = area ? await areaIdByCode(userId, area) : null;
    const id = await addNote(userId, { title, content, areaId });
    return text({ created: id });
  });

  server.registerTool("list_areas", { title: "Areas", description: "The life areas with their codes, standards and weekly target hours.", annotations: read, inputSchema: {} }, async () => text((await listAreas(userId)).map((a) => ({ code: a.code, name: a.name, standard: a.standard, weeklyTargetHours: a.weeklyTargetHours, satisfaction: a.satisfaction }))));

  return server;
}

export async function mcpContext(userId: string): Promise<Ctx> {
  const settings = await getSettingsFor(userId);
  return { userId, settings, today: todayKey(settings.tz, settings.dayStartHour) };
}
