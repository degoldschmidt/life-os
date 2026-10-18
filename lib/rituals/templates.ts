import type { ReviewQuestion } from "@/lib/db/schema";

export type TemplateStep = { id: string; title: string; questions: ReviewQuestion[] };
export type Template = { type: "day" | "week" | "month" | "quarter" | "year"; version: number; name: string; steps: TemplateStep[] };

/** Versioned ritual templates. Editing a template = bump version; past reviews keep theirs. */
export const TEMPLATES: Template[] = [
  {
    type: "day",
    version: 1,
    name: "Daily shutdown",
    steps: [
      { id: "sweep", title: "Sweep", questions: [{ id: "sweep", prompt: "Mark each unfinished task done, deferred or dropped.", kind: "checklist" }] },
      { id: "habits", title: "Habits", questions: [{ id: "habits", prompt: "Tick today's habits.", kind: "checklist" }] },
      { id: "tomorrow", title: "Tomorrow", questions: [{ id: "top3", prompt: "Tomorrow's top 3.", kind: "top3" }] },
      {
        id: "reflect",
        title: "Reflect",
        questions: [
          { id: "went_well", prompt: "What went well today?", kind: "text" },
          { id: "fell_short", prompt: "Where did I fall short?", kind: "text" },
          { id: "better_tomorrow", prompt: "What will I do better tomorrow?", kind: "text" },
          { id: "mood", prompt: "Mood", kind: "scale", max: 5 },
          { id: "energy", prompt: "Energy", kind: "scale", max: 5 },
        ],
      },
    ],
  },
  {
    type: "week",
    version: 1,
    name: "Weekly review",
    steps: [
      {
        id: "clear",
        title: "Clear",
        questions: [
          { id: "inbox_zero", prompt: "Inbox to zero: triage every captured item.", kind: "checklist" },
          { id: "loose_ends", prompt: "What is still on your mind? Capture it.", kind: "text" },
        ],
      },
      { id: "look_back", title: "Look back", questions: [{ id: "look_back_ack", prompt: "Review the week's facts before you judge it.", kind: "checklist" }] },
      {
        id: "goals",
        title: "Goals",
        questions: [
          { id: "goal_progress", prompt: "How much progress did I make on my main goals?", kind: "text" },
          { id: "next_actions", prompt: "Every active project has a next action.", kind: "checklist" },
        ],
      },
      {
        id: "reflect",
        title: "Reflect",
        questions: [
          { id: "wins", prompt: "What specific things did I complete well?", kind: "text" },
          { id: "off_course", prompt: "What pulled me off course, and what will I do differently?", kind: "text" },
          { id: "drained", prompt: "What drained my energy the most?", kind: "text" },
          { id: "joy", prompt: "What brought me the most joy?", kind: "text" },
          { id: "imbalance", prompt: "Is there an imbalance between areas I must look at?", kind: "text" },
        ],
      },
      { id: "look_ahead", title: "Look ahead", questions: [{ id: "top3", prompt: "Three outcomes for next week.", kind: "top3" }] },
      { id: "close", title: "Close", questions: [{ id: "summary", prompt: "One paragraph for future you.", kind: "text" }] },
    ],
  },
  {
    type: "month",
    version: 1,
    name: "Monthly review",
    steps: [
      {
        id: "month",
        title: "The month",
        questions: [
          { id: "one_word", prompt: "Describe the month in one word.", kind: "text" },
          { id: "satisfaction", prompt: "How satisfied am I with the month's results?", kind: "scale", max: 10 },
        ],
      },
      {
        id: "goals",
        title: "Goals and habits",
        questions: [
          { id: "goals_vs_reality", prompt: "Did I reach my goals? What got in the way?", kind: "text" },
          { id: "habits", prompt: "Did habit consistency hold? Which strategies worked?", kind: "text" },
          { id: "finances", prompt: "Finances versus targets.", kind: "text" },
        ],
      },
      { id: "improve", title: "Improve", questions: [{ id: "improvements", prompt: "Three areas to improve, with one concrete action each.", kind: "top3" }] },
    ],
  },
  {
    type: "quarter",
    version: 1,
    name: "Quarterly review",
    steps: [
      { id: "areas", title: "Areas", questions: [{ id: "area_scores", prompt: "Rate each area 1–10. First number that comes to mind.", kind: "area_scores", max: 10 }] },
      {
        id: "goals",
        title: "Score goals",
        questions: [
          { id: "kr_scores", prompt: "Score each key result 0.0–1.0 (0.7 is a win for a stretch goal).", kind: "text" },
          { id: "projects", prompt: "Kill, keep or pivot each project.", kind: "checklist" },
        ],
      },
      {
        id: "next",
        title: "Next quarter",
        questions: [
          { id: "next_goals", prompt: "Two to four goals for next quarter.", kind: "text" },
          { id: "next_habits", prompt: "Which habits run this quarter?", kind: "text" },
        ],
      },
    ],
  },
  {
    type: "year",
    version: 1,
    name: "Annual review",
    steps: [
      {
        id: "past_year",
        title: "Past year",
        questions: [
          { id: "positive", prompt: "Walk the calendar week by week: what created the most positive emotions?", kind: "text" },
          { id: "negative", prompt: "And the most negative?", kind: "text" },
          { id: "more_of", prompt: "Schedule more of the top 20% positive. Wall off the top 20% negative.", kind: "text" },
        ],
      },
      {
        id: "standards",
        title: "Standards",
        questions: [
          { id: "area_standards", prompt: "Rewrite the standard for each area.", kind: "area_scores", max: 10 },
          { id: "theme", prompt: "A theme for the coming year.", kind: "text" },
        ],
      },
    ],
  },
];

export const DEFAULT_AREAS = [
  { code: "WRK", name: "Work / research", standard: "One meaningful result per quarter. Two deep-work mornings a week.", weeklyTargetHours: 32, sort: 0 },
  { code: "HLT", name: "Health & fitness", standard: "Move every day. Sleep 7.5 h. Three runs a week.", weeklyTargetHours: 6, sort: 1 },
  { code: "REL", name: "Relationships & family", standard: "One unhurried family call a week. Friends twice a month.", weeklyTargetHours: 4, sort: 2 },
  { code: "FIN", name: "Finances & admin", standard: "Paperwork inbox empty every Friday. Savings rate on target.", weeklyTargetHours: 1.5, sort: 3 },
];
