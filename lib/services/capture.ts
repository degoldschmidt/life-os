import { parseCapture } from "@/lib/capture/parse";
import { todayKey } from "@/lib/dates";
import { areaIdByCode, listAreas } from "@/lib/services/areas";
import type { Settings } from "@/lib/services/settings";
import { createTask } from "@/lib/services/tasks";

export type CaptureOutcome = { ok: true; id: string; title: string; where: string } | { ok: false; error: string };

/**
 * One line of quick capture for a given user: "call mum tomorrow #REL ~20m".
 * Shared by the browser action, the brain-dump importer and the MCP server.
 */
export async function captureForUser(userId: string, settings: Settings, raw: string, opts: { forceToday?: boolean } = {}): Promise<CaptureOutcome> {
  const input = raw.trim();
  if (!input) return { ok: false, error: "Type something to capture." };
  if (input.length > 500) return { ok: false, error: "That's too long for one task." };
  const today = todayKey(settings.tz, settings.dayStartHour);

  const areas = await listAreas(userId);
  const parsed = parseCapture(input, { tz: settings.tz, areaCodes: areas.map((a) => a.code) });
  const areaId = parsed.areaCode ? await areaIdByCode(userId, parsed.areaCode) : null;

  const plan =
    opts.forceToday || parsed.today
      ? ({ kind: "today", day: today } as const)
      : parsed.date
        ? ({ kind: "date", day: parsed.date } as const)
        : ({ kind: "inbox" } as const);

  const task = await createTask(userId, { title: parsed.title, areaId, estimateMin: parsed.estimateMin, deadline: parsed.deadline, plan });
  return { ok: true, id: task.id, title: parsed.title, where: plan.kind === "today" ? "Today" : plan.kind === "date" ? plan.day : "Inbox" };
}
