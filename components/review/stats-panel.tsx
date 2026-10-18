import { Label, Mono, Rule } from "@/components/ui/label";
import { addNextAction } from "@/app/actions/goals";
import { formatHoursMinutes } from "@/lib/dates";
import { neglectedAreas } from "@/lib/review";
import type { PeriodStats } from "@/lib/services/stats";

const hours = (min: number) => (min / 60).toFixed(1);

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-[10px] bg-tile-2 p-4">
      <Label>{label}</Label>
      <div className="thin mt-2 text-[40px]">{value}</div>
      {sub ? <Mono className="mt-1 block text-muted">{sub}</Mono> : null}
    </div>
  );
}

/** The week's (or month's, quarter's, year's) facts, before any judgement. */
export function StatsPanel({ stats, showProjects = true }: { stats: PeriodStats; showProjects?: boolean }) {
  const { tasks, habits, areas, perDay } = stats;
  const rate = tasks.rate == null ? "—" : `${Math.round(tasks.rate * 100)}%`;
  const habitDone = habits.reduce((a, h) => a + h.done, 0);
  const habitDue = habits.reduce((a, h) => a + h.due, 0);
  const maxArea = Math.max(1, ...areas.map((a) => Math.max(a.targetMin, a.scheduledMin)));
  const maxDay = Math.max(60, ...perDay.map((d) => d.scheduledMin));
  const neglected = neglectedAreas(areas);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Planned vs done"
          value={<>{tasks.done}<span className="text-muted">/{tasks.planned}</span></>}
          sub={`${rate}${tasks.plannedMin ? ` · ${formatHoursMinutes(tasks.doneMin)} OF ${formatHoursMinutes(tasks.plannedMin)}` : ""}`.toUpperCase()}
        />
        <Metric label="Deep work" value={<>{hours(stats.deepMin)}<span className="text-[20px] text-muted"> h</span></>} sub={`${hours(stats.scheduledMin)} H SCHEDULED`} />
        <Metric
          label="Habits"
          value={<>{habitDone}<span className="text-muted">/{habitDue}</span></>}
          sub={stats.habitRate == null ? "NO HABITS" : `${Math.round(stats.habitRate * 100)}%`}
        />
      </div>

      <div>
        <div className="flex justify-between"><Label>Attention per area, hours</Label><Label>| target</Label></div>
        <Rule />
        {areas.map((a) => (
          <div key={a.code} className="my-3 grid grid-cols-[40px_minmax(0,1fr)_44px] items-center gap-3">
            <span className="label">{a.code}</span>
            <div className="relative h-[6px] rounded-[3px] bg-tile-2" role="img" aria-label={`${a.code}: ${hours(a.scheduledMin)} of ${hours(a.targetMin)} hours`}>
              <span
                className="absolute left-0 top-0 h-full rounded-[3px]"
                style={{ width: `${(a.scheduledMin / maxArea) * 100}%`, background: neglected.some((n) => n.code === a.code) ? "var(--orange)" : "var(--text)" }}
              />
              {a.targetMin > 0 ? <i className="absolute -top-[5px] block h-4 w-[1.5px] bg-text" style={{ left: `${(a.targetMin / maxArea) * 100}%` }} /> : null}
            </div>
            <Mono className="text-right">{hours(a.scheduledMin)}</Mono>
          </div>
        ))}
        {neglected.length ? (
          <p className="mt-2 text-[13px] text-orange">
            {neglected.map((n) => `${n.code} got ${hours(n.scheduledMin)} h against ${hours(n.targetMin)} h`).join(". ")}.
          </p>
        ) : null}
      </div>

      {stats.days <= 14 ? (
        <div>
          <Label>Scheduled hours by day</Label>
          <div className="mt-3 flex h-[84px] items-end gap-2">
            {perDay.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1">
                <i className="block w-full rounded-[2px] bg-text" style={{ height: `${Math.max(2, (d.scheduledMin / maxDay) * 64)}px`, opacity: d.scheduledMin ? 1 : 0.15 }} />
                <Mono className="text-muted">{d.day.slice(8)}</Mono>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Mood" value={stats.mood == null ? "—" : stats.mood.toFixed(1)} sub="AVERAGE OF 5" />
        <Metric label="Energy" value={stats.energy == null ? "—" : stats.energy.toFixed(1)} sub="AVERAGE OF 5" />
        <Metric label="Shutdowns" value={stats.dayReviews} sub={`OF ${stats.days} DAYS`} />
      </div>

      {showProjects && stats.projectsNoNext.length ? (
        <div>
          <Label>Active projects without a next action</Label>
          <Rule />
          {stats.projectsNoNext.map((p) => (
            <form key={p.id} action={addNextAction} className="leader flex flex-wrap items-center gap-2 py-3 last:border-b-0">
              <input type="hidden" name="projectId" value={p.id} />
              <span className="min-w-[140px] flex-1 text-[14px]">{p.title} <span className="label text-muted">{p.areaCode}</span></span>
              <input name="title" required maxLength={300} placeholder="Next action" className="min-w-[160px] flex-1 rounded-[8px] border border-line bg-transparent px-3 py-2 text-[14px]" />
              <button type="submit" className="label rounded-full border border-line px-3 py-2 text-muted hover:border-text hover:text-text">Add</button>
            </form>
          ))}
        </div>
      ) : null}
    </div>
  );
}
