/** Pure Markdown rendering for the Obsidian-style vault export. */

export type MdEntry = { kind: string; time: string; text: string; mood: number | null; energy: number | null };

const KIND: Record<string, string> = { morning: "Intention", interstitial: "Note", shutdown: "Shutdown", freeform: "Day note" };

export function dayNote(day: string, entries: MdEntry[], tasksDone: string[], area?: Record<string, number>): string {
  const lines: string[] = ["---", `date: ${day}`, "type: day"];
  const mood = [...entries].reverse().find((e) => e.mood != null)?.mood;
  const energy = [...entries].reverse().find((e) => e.energy != null)?.energy;
  if (mood != null) lines.push(`mood: ${mood}`);
  if (energy != null) lines.push(`energy: ${energy}`);
  lines.push("---", "", `# ${day}`, "");
  if (tasksDone.length) {
    lines.push("## Done", "", ...tasksDone.map((t) => `- [x] ${t}`), "");
  }
  for (const e of entries) {
    lines.push(`## ${KIND[e.kind] ?? e.kind} ${e.time}`.trimEnd(), "");
    if (e.text.trim()) lines.push(e.text.trim(), "");
  }
  void area;
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export type MdQuestion = { id: string; prompt: string };

function answerText(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.filter(Boolean).map((x, i) => `${i + 1}. ${x}`).join("\n");
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, x]) => `- ${k}: ${x}`).join("\n");
  return String(v);
}

export function reviewNote(input: {
  type: string;
  periodId: string;
  start: string;
  end: string;
  status: string;
  questions: MdQuestion[];
  answers: Record<string, unknown>;
  nextTop3: string[];
  scores: Record<string, number>;
}): string {
  const lines = ["---", `type: ${input.type}-review`, `period: ${input.periodId}`, `start: ${input.start}`, `end: ${input.end}`, `status: ${input.status}`, "---", "", `# ${input.type[0].toUpperCase()}${input.type.slice(1)} review ${input.periodId}`, ""];
  const scoreKeys = Object.keys(input.scores).sort();
  if (scoreKeys.length) {
    lines.push("## Numbers", "", ...scoreKeys.map((k) => `- ${k}: ${input.scores[k]}`), "");
  }
  for (const q of input.questions) {
    const a = answerText(input.answers[q.id]);
    if (!a) continue;
    lines.push(`## ${q.prompt}`, "", a, "");
  }
  if (input.nextTop3.length) lines.push("## Next", "", ...input.nextTop3.map((t, i) => `${i + 1}. ${t}`), "");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function slug(title: string): string {
  const s = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || "untitled";
}

export function areasNote(areas: { code: string; name: string; standard: string | null; weeklyTargetHours: number | null; satisfaction: number | null }[]): string {
  const lines = ["# Areas", ""];
  for (const a of areas) {
    lines.push(`## ${a.code} · ${a.name}`, "");
    if (a.standard) lines.push(a.standard, "");
    const meta = [a.weeklyTargetHours != null ? `target ${a.weeklyTargetHours} h/week` : "", a.satisfaction != null ? `satisfaction ${a.satisfaction}/10` : ""].filter(Boolean);
    if (meta.length) lines.push(`_${meta.join(" · ")}_`, "");
  }
  return lines.join("\n").trimEnd() + "\n";
}
