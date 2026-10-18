import { minutesToInstant } from "@/lib/blocks";

export type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  etag?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
};

export type MappedEvent = {
  id: string; // calendarId|eventId
  calendarId: string;
  etag: string | null;
  summary: string | null;
  startAt: Date | null;
  endAt: Date | null;
  allDay: boolean;
  status: string | null;
  cancelled: boolean;
};

/**
 * Google event -> our cached row. Timed events keep their absolute instant; all-day events
 * (which only carry a date) are anchored at local midnight in the user's zone.
 */
export function mapGoogleEvent(calendarId: string, ev: GoogleEvent, tz: string): MappedEvent {
  const base = { id: `${calendarId}|${ev.id}`, calendarId, etag: ev.etag ?? null, summary: ev.summary ?? null, status: ev.status ?? null };
  if (ev.status === "cancelled") return { ...base, startAt: null, endAt: null, allDay: false, cancelled: true };
  if (ev.start?.dateTime) {
    const startAt = new Date(ev.start.dateTime);
    const endAt = ev.end?.dateTime ? new Date(ev.end.dateTime) : new Date(startAt.getTime() + 30 * 60_000);
    return { ...base, startAt, endAt, allDay: false, cancelled: false };
  }
  if (ev.start?.date) {
    const startAt = minutesToInstant(ev.start.date, 0, tz);
    const endAt = ev.end?.date ? minutesToInstant(ev.end.date, 0, tz) : new Date(startAt.getTime() + 24 * 3600_000);
    return { ...base, startAt, endAt, allDay: true, cancelled: false };
  }
  return { ...base, startAt: null, endAt: null, allDay: false, cancelled: true };
}
