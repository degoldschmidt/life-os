import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { DayKey } from "@/lib/dates";
import { instantToMinutes, minutesToInstant } from "@/lib/blocks";

export type CalendarEventView = { id: string; day: DayKey; startMin: number; endMin: number; title: string; allDay: boolean };

/** Cached Google Calendar events in [from, to]. Empty until the calendar is connected (phase 4). */
export async function listCalendarEvents(userId: string, from: DayKey, to: DayKey, tz: string): Promise<CalendarEventView[]> {
  const rows = await db()
    .select()
    .from(schema.calendarEvents)
    .where(
      and(
        eq(schema.calendarEvents.userId, userId),
        gte(schema.calendarEvents.startAt, minutesToInstant(from, 0, tz)),
        lte(schema.calendarEvents.startAt, minutesToInstant(to, 24 * 60 - 1, tz)),
      ),
    )
    .orderBy(asc(schema.calendarEvents.startAt));
  const out: CalendarEventView[] = [];
  for (const r of rows) {
    if (r.status === "cancelled" || !r.startAt) continue;
    const startMin = instantToMinutes(r.startAt, tz);
    const endMin = r.endAt ? startMin + Math.round((r.endAt.getTime() - r.startAt.getTime()) / 60000) : startMin + 30;
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(r.startAt);
    out.push({ id: r.id, day, startMin, endMin: Math.min(endMin, 24 * 60), title: r.summary ?? "Busy", allDay: r.allDay });
  }
  return out;
}
