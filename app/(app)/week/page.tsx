import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Tile } from "@/components/ui/tile";
import { Label, Mono } from "@/components/ui/label";
import { WeekBoard, type WeekDay } from "@/components/week/week-board";
import { requireUser } from "@/lib/auth";
import { addDaysToKey, dayKeyToDate, periodFor, todayKey } from "@/lib/dates";
import { getSettings } from "@/lib/services/settings";
import { listAreas } from "@/lib/services/areas";
import { listBacklog, listBlocks } from "@/lib/services/blocks";
import { listCalendarEvents } from "@/lib/services/calendar";

export const metadata: Metadata = { title: "Week" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function WeekPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const user = await requireUser();
  const settings = await getSettings();
  const today = todayKey(settings.tz, settings.dayStartHour);
  const anchor = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : today;
  const week = periodFor("week", anchor, settings.tz);
  const thisWeek = periodFor("week", today, settings.tz);

  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const key = addDaysToKey(week.start, i, settings.tz);
    const d = dayKeyToDate(key, settings.tz);
    return { key, label: format(d, "EEE d"), short: format(d, "EEE"), isToday: key === today };
  });

  const [blocks, backlog, areas, events] = await Promise.all([
    listBlocks(user.id, week.start, week.end, settings.tz),
    listBacklog(user.id),
    listAreas(user.id),
    listCalendarEvents(user.id, week.start, week.end, settings.tz),
  ]);

  const [sh, sm] = settings.shutdownTime.split(":").map(Number);
  const weekNo = week.id.split("-")[1];

  return (
    <div className="flex flex-col gap-[14px]">
      <Tile dark className="flex flex-wrap items-center justify-between gap-4 !py-4">
        <div className="flex items-baseline gap-4">
          <Label>Week</Label>
          <span className="thin text-[44px]">{weekNo}</span>
          <Mono className="text-muted">{format(dayKeyToDate(week.start, settings.tz), "d MMM")} – {format(dayKeyToDate(week.end, settings.tz), "d MMM yyyy")}</Mono>
        </div>
        <div className="flex items-center gap-4">
          <Link href={`/week?d=${addDaysToKey(week.start, -7, settings.tz)}`} className="label text-muted hover:text-on-ink" aria-label="Previous week">← Prev</Link>
          {week.id !== thisWeek.id ? <Link href="/week" className="label text-muted underline hover:text-on-ink">This week</Link> : null}
          <Link href={`/week?d=${addDaysToKey(week.start, 7, settings.tz)}`} className="label text-muted hover:text-on-ink" aria-label="Next week">Next →</Link>
        </div>
      </Tile>
      <WeekBoard
        days={days}
        blocks={blocks}
        events={events}
        backlog={backlog.map((t) => ({ id: t.id, title: t.title, areaCode: t.areaCode, estimateMin: t.estimateMin }))}
        tz={settings.tz}
        capacityMin={settings.dailyCapacityMin}
        shutdownMin={sh * 60 + sm}
        areaCodes={areas.map((a) => a.code)}
      />
    </div>
  );
}
