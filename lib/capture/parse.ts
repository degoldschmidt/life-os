import * as chrono from "chrono-node";
import { DEFAULT_TZ, type DayKey } from "@/lib/dates";

export type ParsedCapture = {
  title: string;
  areaCode: string | null;
  estimateMin: number | null;
  /** Local day the user mentioned ("tomorrow", "20 dec"), if any. */
  date: DayKey | null;
  /** Explicit "today" or a date equal to today: plan it for today. */
  today: boolean;
  deadline: DayKey | null;
};

const AREA_RE = /(^|\s)#([a-z]{3})(?=\s|$)/i;
const EST_RE = /(^|\s)~(?:(\d+(?:\.\d+)?)\s*h(?:\s*(\d{1,2})\s*m?)?|(\d+)\s*m(?:in)?)(?=\s|$)/i;
const DEADLINE_RE = /(^|\s)(?:due|by)\s+(?=\S)/i;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Parse one line of quick capture.
 *
 *   "call mum tomorrow #REL ~20m"      -> area REL, 20 min, tomorrow
 *   "file expense report friday #FIN"  -> area FIN, friday
 *   "submit paper due 30 nov #WRK"     -> deadline 30 Nov (and no schedule)
 *
 * Words are only removed from the title when they were understood, so nothing the user
 * typed is lost silently.
 */
export function parseCapture(
  input: string,
  opts: { now?: Date; tz?: string; areaCodes?: string[] } = {},
): ParsedCapture {
  const tz = opts.tz ?? DEFAULT_TZ;
  const now = opts.now ?? new Date();
  const knownCodes = opts.areaCodes?.map((c) => c.toUpperCase());
  let text = input.trim().replace(/\s+/g, " ");

  let areaCode: string | null = null;
  const areaMatch = text.match(AREA_RE);
  if (areaMatch) {
    const code = areaMatch[2].toUpperCase();
    if (!knownCodes || knownCodes.includes(code)) {
      areaCode = code;
      text = text.replace(AREA_RE, " ").trim();
    }
  }

  let estimateMin: number | null = null;
  const estMatch = text.match(EST_RE);
  if (estMatch) {
    if (estMatch[2] !== undefined) {
      estimateMin = Math.round(parseFloat(estMatch[2]) * 60 + (estMatch[3] ? parseInt(estMatch[3], 10) : 0));
    } else {
      estimateMin = parseInt(estMatch[4], 10);
    }
    text = text.replace(EST_RE, " ").trim();
  }

  // "due"/"by <date>" marks a deadline instead of a scheduled day.
  let isDeadline = false;
  const dueMatch = text.match(DEADLINE_RE);
  if (dueMatch) {
    isDeadline = true;
    text = text.replace(DEADLINE_RE, "$1").trim();
  }

  let date: DayKey | null = null;
  let explicitToday = false;
  const results = chrono.parse(text, { instant: now, timezone: tz }, { forwardDate: true });
  const hit = results[0];
  if (hit) {
    const y = hit.start.get("year");
    const m = hit.start.get("month");
    const d = hit.start.get("day");
    if (y && m && d) {
      date = `${y}-${pad(m)}-${pad(d)}`;
      const before = text.slice(0, hit.index);
      const after = text.slice(hit.index + hit.text.length);
      // Drop a dangling preposition left in front of the date ("pay rent on friday").
      const trimmedBefore = before.replace(/\s+(on|at|by|for|until)$/i, "").trimEnd();
      text = `${trimmedBefore} ${after}`.replace(/\s+/g, " ").trim();
      explicitToday = /^(today|tonight|this (morning|afternoon|evening))$/i.test(hit.text.trim());
    }
  }

  const title = text.replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, "").trim() || input.trim();
  const nowKey = (() => {
    const p = chrono.parse("today", { instant: now, timezone: tz })[0];
    return p ? `${p.start.get("year")}-${pad(p.start.get("month")!)}-${pad(p.start.get("day")!)}` : null;
  })();

  return {
    title,
    areaCode,
    estimateMin,
    date: isDeadline ? null : date,
    today: explicitToday || (!isDeadline && date !== null && date === nowKey),
    deadline: isDeadline ? date : null,
  };
}
