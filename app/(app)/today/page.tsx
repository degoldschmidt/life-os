import type { Metadata } from "next";
import { format } from "date-fns";
import { Tile } from "@/components/ui/tile";
import { Label, Mono, Rule } from "@/components/ui/label";
import { ThinNumber } from "@/components/ui/thin-number";
import { OrangeDot } from "@/components/ui/dot";
import { Meter } from "@/components/ui/meter";
import { TaskRow } from "@/components/tasks/task-row";
import { CaptureButtonInline } from "@/components/capture/capture-inline";
import { requireUser } from "@/lib/auth";
import { dayKeyToDate, formatHoursMinutes, periodFor, todayKey } from "@/lib/dates";
import { nextFreeRank, splitTop, summarizeDay } from "@/lib/planning";
import { getSettings } from "@/lib/services/settings";
import { listDay, listStale, materializeRecurring } from "@/lib/services/tasks";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const user = await requireUser();
  const settings = await getSettings();
  const key = todayKey(settings.tz, settings.dayStartHour);
  const d = dayKeyToDate(key, settings.tz);
  const week = periodFor("week", key, settings.tz);

  await materializeRecurring(user.id, key);
  const [dayTasks, stale] = await Promise.all([listDay(user.id, key), listStale(user.id, key)]);

  const { top, rest } = splitTop(dayTasks.filter((t) => t.status === "todo"));
  const doneTasks = dayTasks.filter((t) => t.status === "done");
  const s = summarizeDay(dayTasks, settings.dailyCapacityMin);
  const free = nextFreeRank(dayTasks);
  const focus = top[0];

  return (
    <div className="grid gap-[14px] md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
      <Tile dark className="flex flex-col md:row-span-2">
        <div className="flex justify-between">
          <Label>{format(d, "EEE")} · {week.id.split("-")[1]}</Label>
          <OrangeDot />
        </div>
        <ThinNumber size={112} className="mt-5">{format(d, "d")}</ThinNumber>
        <Label className="mt-1 text-on-ink">{format(d, "MMMM yyyy")}</Label>
        <Rule dotted className="my-5" />
        <Label>Focus</Label>
        <p className="mt-2 text-[16px] leading-[1.35]">
          {focus ? focus.title : <span className="text-muted">Pick a Top 3 task to set today&apos;s focus.</span>}
        </p>
        <div className="mt-auto flex justify-between pt-6">
          <Mono className="text-muted">{s.open} OPEN</Mono>
          <Mono className="text-muted">SHUTDOWN {settings.shutdownTime}</Mono>
        </div>
      </Tile>

      <div className="flex flex-col gap-[14px]">
        <Tile>
          <div className="flex justify-between">
            <Label>Top 3</Label>
            <Label>{top.length}/3</Label>
          </div>
          <Rule dotted />
          {top.length === 0 ? (
            <p className="py-4 text-[14px] text-muted">
              Nothing ranked yet. Open a task below and choose Top 1, 2 or 3, or capture something new.
            </p>
          ) : (
            top.map((t, i) => <TaskRow key={t.id} task={t} mode="today" index={i + 1} />)
          )}
          {free ? <p className="label mt-2 text-muted">Slot {free} is free</p> : null}
        </Tile>

        <Tile>
          <div className="flex justify-between">
            <Label>Later today</Label>
            <Label>{rest.length}</Label>
          </div>
          <Rule dotted />
          {rest.length === 0 ? (
            <p className="py-3 text-[14px] text-muted">Nothing else planned.</p>
          ) : (
            rest.map((t, i) => <TaskRow key={t.id} task={t} mode="today" index={top.length + i + 1} />)
          )}
          <div className="mt-4 flex gap-[10px]">
            <CaptureButtonInline />
          </div>
        </Tile>

        {doneTasks.length ? (
          <Tile>
            <div className="flex justify-between">
              <Label>Done</Label>
              <Label>{doneTasks.length}</Label>
            </div>
            <Rule dotted />
            {doneTasks.map((t) => (
              <TaskRow key={t.id} task={t} mode="today" />
            ))}
          </Tile>
        ) : null}

        {stale.length ? (
          <Tile>
            <div className="flex justify-between">
              <Label>Unfinished from earlier</Label>
              <Label className="text-orange">{stale.length}</Label>
            </div>
            <Rule dotted />
            {stale.map((t) => (
              <TaskRow key={t.id} task={t} mode="stale" />
            ))}
            <p className="label mt-3 text-muted">Nothing rolls over by itself. Decide for each.</p>
          </Tile>
        ) : null}
      </div>

      <Tile className="hidden xl:block xl:row-span-2">
        <div className="flex justify-between">
          <Label>Calendar</Label>
          <Label>Google · phase 4</Label>
        </div>
        <div className="relative mt-3 h-[420px]">
          {["09", "10", "11", "12", "14", "15"].map((h, i) => (
            <div key={h} className="hairline absolute inset-x-0 pt-[3px]" style={{ top: i * 70 }}>
              <Mono className="text-muted">{h}</Mono>
            </div>
          ))}
        </div>
      </Tile>

      <div className="grid gap-[14px] sm:grid-cols-2 md:col-start-2 xl:col-start-2">
        <Tile>
          <Label>Planned</Label>
          <ThinNumber size={72} className="mt-4">{formatHoursMinutes(s.plannedMin)}</ThinNumber>
          <Rule />
          <div className="mono flex justify-between">
            <span className="text-muted">CAPACITY</span>
            <span>{formatHoursMinutes(s.capacityMin)}</span>
          </div>
          <div className="mt-3">
            <Meter value={s.plannedMin + s.doneMin} max={s.capacityMin} label="Planned hours" />
          </div>
          {s.unestimated ? <p className="label mt-3 text-muted">{s.unestimated} without estimate</p> : null}
          {s.over ? <p className="label mt-2 text-orange">Over capacity. Cut something.</p> : null}
        </Tile>
        <Tile>
          <Label>Done</Label>
          <ThinNumber size={72} className="mt-4" muted={`/${s.total}`}>{s.done}</ThinNumber>
          <Rule />
          <div className="mono flex justify-between">
            <span className="text-muted">TIME DONE</span>
            <span>{formatHoursMinutes(s.doneMin)}</span>
          </div>
          <div className="mono mt-2 flex justify-between">
            <span className="text-muted">OPEN</span>
            <span>{s.open}</span>
          </div>
        </Tile>
      </div>
    </div>
  );
}
