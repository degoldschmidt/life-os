import type { Metadata } from "next";
import { Tile } from "@/components/ui/tile";
import { Label, Mono, Rule } from "@/components/ui/label";
import { ThinNumber } from "@/components/ui/thin-number";
import { Button } from "@/components/ui/button";
import { HabitToggle } from "@/components/habits/habit-toggle";
import { HabitGrid } from "@/components/habits/habit-grid";
import { archiveHabit, createHabit } from "@/app/actions/habits";
import { requireUser } from "@/lib/auth";
import { todayKey } from "@/lib/dates";
import { MAX_ACTIVE_HABITS } from "@/lib/habits";
import { listAreas } from "@/lib/services/areas";
import { listHabitStatuses } from "@/lib/services/habits";
import { getSettings } from "@/lib/services/settings";

export const metadata: Metadata = { title: "Habits" };

function rhythmLabel(s: { days: number[] } | { perWeek: number }) {
  if ("perWeek" in s) return `${s.perWeek}× a week`;
  if (s.days.length === 7) return "Every day";
  if (s.days.length === 5 && !s.days.includes(6) && !s.days.includes(7)) return "Weekdays";
  return `${s.days.length} days`;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HabitsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const user = await requireUser();
  const settings = await getSettings();
  const today = todayKey(settings.tz, settings.dayStartHour);
  const [habits, areas] = await Promise.all([listHabitStatuses(user.id, today), listAreas(user.id)]);
  const error = typeof sp.error === "string" ? (sp.error === "invalid" ? "Give the habit a name." : sp.error) : null;
  const doneToday = habits.filter((h) => h.status.doneToday).length;
  const dueToday = habits.filter((h) => h.status.dueToday).length;

  return (
    <div className="grid gap-[14px] md:grid-cols-[240px_minmax(0,1fr)]">
      <Tile dark className="flex flex-col">
        <Label>Habits · today</Label>
        <ThinNumber size={96} className="mt-5" muted={`/${dueToday}`}>{doneToday}</ThinNumber>
        <Rule dotted className="my-5" />
        <p className="text-[14px] text-muted">
          At most {MAX_ACTIVE_HABITS}. Missing once is fine. The orange ring means you missed the last due day, so don&apos;t miss twice.
        </p>
        <Mono className="mt-auto pt-6 text-muted">{habits.length}/{MAX_ACTIVE_HABITS} ACTIVE</Mono>
      </Tile>

      <div className="flex flex-col gap-[14px]">
        {habits.length === 0 ? (
          <Tile>
            <p className="text-[18px]">No habits yet.</p>
            <p className="mt-1 text-[14px] text-muted">Start with one small thing you can do on your worst day.</p>
          </Tile>
        ) : (
          habits.map((h) => (
            <Tile key={h.id}>
              <div className="flex items-start gap-4">
                <HabitToggle habitId={h.id} name={h.name} done={h.status.doneToday} nudge={h.status.missedLastDue && !h.status.doneToday} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[16px]">{h.name}</span>
                    <span className="flex items-center gap-3">
                      {h.areaCode ? <Label>{h.areaCode}</Label> : null}
                      <Label>{rhythmLabel(h.schedule)}</Label>
                    </span>
                  </div>
                  {h.intention ? <p className="mt-1 text-[13px] text-muted">{h.intention}</p> : null}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <HabitGrid cells={h.status.grid} label={`${h.name}: last 14 days`} />
                    <Mono className="text-muted">
                      {h.status.doneInWindow}/{h.status.dueInWindow} · 14 D
                      {h.status.missedLastDue && !h.status.doneToday ? <span className="text-orange"> · DON&apos;T MISS TWICE</span> : null}
                    </Mono>
                  </div>
                </div>
                <form action={archiveHabit.bind(null, h.id)}>
                  <button type="submit" className="label text-muted hover:text-text" aria-label={`Archive ${h.name}`}>Archive</button>
                </form>
              </div>
            </Tile>
          ))
        )}

        {habits.length < MAX_ACTIVE_HABITS ? (
          <Tile>
            <Label>New habit</Label>
            <Rule dotted />
            <form action={createHabit} className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="label text-muted">Name</span>
                <input name="name" required maxLength={80} placeholder="Stretch for 5 minutes" className="rounded-[8px] border border-line bg-transparent px-3 py-[10px] text-[15px]" />
              </label>
              <label className="flex flex-col gap-2">
                <span className="label text-muted">Rhythm</span>
                <select name="rhythm" defaultValue="daily" className="rounded-[8px] border border-line bg-transparent px-3 py-[10px] text-[15px]">
                  <option value="daily">Every day</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="1">1× a week</option>
                  <option value="2">2× a week</option>
                  <option value="3">3× a week</option>
                  <option value="4">4× a week</option>
                  <option value="5">5× a week</option>
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="label text-muted">Area</span>
                <select name="area" defaultValue="" className="rounded-[8px] border border-line bg-transparent px-3 py-[10px] text-[15px]">
                  <option value="">None</option>
                  {areas.map((a) => (
                    <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="label text-muted">Cue (optional)</span>
                <input name="intention" maxLength={200} placeholder="After I brush my teeth, I will…" className="rounded-[8px] border border-line bg-transparent px-3 py-[10px] text-[15px]" />
              </label>
              {error ? <p className="text-[13px] text-orange sm:col-span-2">{error}</p> : null}
              <div className="sm:col-span-2"><Button type="submit">Add habit</Button></div>
            </form>
          </Tile>
        ) : null}
      </div>
    </div>
  );
}
