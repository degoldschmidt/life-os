import type { Metadata } from "next";
import { Tile } from "@/components/ui/tile";
import { Label, Mono, Rule } from "@/components/ui/label";
import { DotGrid } from "@/components/ui/dot-grid";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { formatHoursMinutes, periodFor, todayKey } from "@/lib/dates";
import { dotsFor, goalProgress, staleness } from "@/lib/goals";
import { getSettings } from "@/lib/services/settings";
import { areaOverview, type GoalView, type ProjectView } from "@/lib/services/goals";
import { addGoal, addNextAction, addProject, saveArea, setProjectStatus, updateGoal } from "@/app/actions/goals";

export const metadata: Metadata = { title: "Goals" };

const input = "rounded-[8px] border border-line bg-transparent px-3 py-[9px] text-[14px] w-full";
const summary = "label cursor-pointer list-none text-muted hover:text-text [&::-webkit-details-marker]:hidden";

const daysAgo = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000);

function GoalBlock({ goal }: { goal: GoalView }) {
  const progress = goalProgress(goal.keyResults);
  const idle = staleness(daysAgo(goal.lastTouched));
  return (
    <div className="leader py-4 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px]">{goal.title}</span>
        <Label>{goal.period}</Label>
      </div>
      {goal.keyResults.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-3">
          <DotGrid total={21} filled={dotsFor(progress)} label={`${Math.round((progress ?? 0) * 100)}% of key results`} />
          <ul className="mono text-[12px]">
            {goal.keyResults.map((kr) => (
              <li key={kr.id} className="py-[2px]">
                <span className="text-muted">{kr.metric}</span> {kr.current}/{kr.target}
                {kr.unit ? ` ${kr.unit}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-muted">No key results yet. Add one so progress can show.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {goal.confidence != null ? <Mono className="text-muted">CONFIDENCE {goal.confidence}/10</Mono> : null}
        {idle !== "fresh" ? <Mono className="text-orange">{idle === "stale" ? "UNTOUCHED 2+ WEEKS" : "UNTOUCHED THIS WEEK"}</Mono> : null}
      </div>
      <details className="mt-3">
        <summary className={summary}>Update</summary>
        <form action={updateGoal} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={goal.id} />
          {goal.keyResults.map((kr, i) => (
            <label key={kr.id} className="flex flex-col gap-1">
              <span className="label text-muted">{kr.metric} (now)</span>
              <input name={`kr${i + 1}`} type="number" step="any" defaultValue={kr.current} className={input} />
            </label>
          ))}
          <label className="flex flex-col gap-1">
            <span className="label text-muted">Confidence 1–10</span>
            <input name="confidence" type="number" min={1} max={10} defaultValue={goal.confidence ?? ""} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label text-muted">Status</span>
            <select name="status" defaultValue={goal.status} className={input}>
              <option value="active">Active</option>
              <option value="achieved">Achieved</option>
              <option value="dropped">Dropped</option>
            </select>
          </label>
          <div className="sm:col-span-2"><Button type="submit">Save</Button></div>
        </form>
      </details>
    </div>
  );
}

function ProjectRow({ p }: { p: ProjectView }) {
  const idle = staleness(daysAgo(p.lastTouched));
  const noNext = p.status === "active" && !p.nextAction;
  return (
    <div className="leader py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px]">{p.title}</span>
        <span className="flex items-center gap-3">
          {p.deadline ? <Mono className="text-muted">DUE {p.deadline.slice(5)}</Mono> : null}
          {p.status === "someday" ? <Label>Someday</Label> : null}
        </span>
      </div>
      <p className={`mt-1 text-[13px] ${noNext ? "text-orange" : "text-muted"}`}>
        {p.nextAction ? `Next: ${p.nextAction}` : p.status === "active" ? "No next action" : ""}
        {p.openTasks > 1 ? <span className="text-muted"> · {p.openTasks} open</span> : null}
        {idle === "stale" && p.status === "active" ? <span className="text-orange"> · idle 2+ weeks</span> : null}
      </p>
      <details className="mt-2">
        <summary className={summary}>Actions</summary>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <form action={addNextAction} className="flex min-w-[220px] flex-1 gap-2">
            <input type="hidden" name="projectId" value={p.id} />
            <input name="title" required maxLength={300} placeholder="Add a next action" className={input} />
            <Button type="submit">Add</Button>
          </form>
          <form action={setProjectStatus.bind(null, p.id, p.status === "someday" ? "active" : "someday")}>
            <Button type="submit" variant="quiet">{p.status === "someday" ? "Activate" : "Someday"}</Button>
          </form>
          <form action={setProjectStatus.bind(null, p.id, "done")}><Button type="submit" variant="quiet">Done</Button></form>
        </div>
      </details>
    </div>
  );
}

export default async function GoalsPage() {
  const user = await requireUser();
  const settings = await getSettings();
  const today = todayKey(settings.tz, settings.dayStartHour);
  const quarter = periodFor("quarter", today, settings.tz);
  const year = periodFor("year", today, settings.tz);
  const week = periodFor("week", today, settings.tz);
  const overview = await areaOverview(user.id, [quarter.id, year.id], week.start, week.end);

  const totalGoals = overview.reduce((a, o) => a + o.goals.length, 0);
  const noNext = overview.reduce((a, o) => a + o.projects.filter((p) => p.status === "active" && !p.nextAction).length, 0);

  return (
    <div className="flex flex-col gap-[14px]">
      <Tile dark className="flex flex-wrap items-center justify-between gap-4 !py-4">
        <div className="flex items-baseline gap-4">
          <Label>Goals</Label>
          <span className="thin text-[44px]">{quarter.id.split("-")[1]}</span>
          <Mono className="text-muted">{year.id}</Mono>
        </div>
        <div className="mono flex gap-6 text-muted">
          <span>{totalGoals} GOALS</span>
          <span className={noNext ? "text-orange" : ""}>{noNext} PROJECTS WITHOUT NEXT ACTION</span>
        </div>
      </Tile>

      <div className="grid gap-[14px] xl:grid-cols-2">
        {overview.map(({ area, goals, projects, attentionMin }, i) => (
          <Tile key={area.id} className="flex flex-col">
            <div className="flex items-center justify-between">
              <Label>{String(i + 1).padStart(2, "0")} — {area.code}</Label>
              <Mono className={area.weeklyTargetHours && attentionMin < area.weeklyTargetHours * 60 * 0.5 ? "text-orange" : "text-muted"}>
                {formatHoursMinutes(attentionMin)}{area.weeklyTargetHours ? ` / ${area.weeklyTargetHours} H` : ""} THIS WEEK
              </Mono>
            </div>
            <h2 className="mt-3 text-[22px] font-normal leading-[1.15]">{area.name}</h2>
            <p className="mt-1 text-[14px] text-muted">{area.standard || "No standard yet. What does good look like here?"}</p>
            {area.satisfaction ? <Mono className="mt-2 text-muted">SATISFACTION {area.satisfaction}/10</Mono> : null}

            <details className="mt-3">
              <summary className={summary}>Edit area</summary>
              <form action={saveArea} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="code" value={area.code} />
                <label className="flex flex-col gap-1 sm:col-span-2"><span className="label text-muted">Name</span><input name="name" required defaultValue={area.name} className={input} /></label>
                <label className="flex flex-col gap-1 sm:col-span-2"><span className="label text-muted">Standard: what does good look like?</span><textarea name="standard" rows={2} defaultValue={area.standard ?? ""} className={input} /></label>
                <label className="flex flex-col gap-1"><span className="label text-muted">Target hours a week</span><input name="weeklyTargetHours" type="number" step="0.5" min={0} defaultValue={area.weeklyTargetHours ?? ""} className={input} /></label>
                <label className="flex flex-col gap-1"><span className="label text-muted">Satisfaction 1–10</span><input name="satisfaction" type="number" min={1} max={10} defaultValue={area.satisfaction ?? ""} className={input} /></label>
                <div className="sm:col-span-2"><Button type="submit">Save area</Button></div>
              </form>
            </details>

            <Rule />
            <Label>Goals</Label>
            {goals.length === 0 ? <p className="py-3 text-[14px] text-muted">No goal for this {quarter.id.split("-")[1]} yet.</p> : goals.map((g) => <GoalBlock key={g.id} goal={g} />)}
            <details className="mt-2">
              <summary className={summary}>+ Add goal</summary>
              <form action={addGoal} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="area" value={area.code} />
                <label className="flex flex-col gap-1 sm:col-span-2"><span className="label text-muted">Goal</span><input name="title" required maxLength={200} placeholder="Submit the connectivity paper" className={input} /></label>
                <label className="flex flex-col gap-1">
                  <span className="label text-muted">Horizon</span>
                  <select name="horizon" defaultValue="quarter" className={input}>
                    <option value="quarter">This quarter ({quarter.id.split("-")[1]})</option>
                    <option value="year">This year ({year.id})</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="label text-muted">Key results (one per line: metric | target | unit)</span>
                  <textarea name="krs" rows={3} placeholder={"Figures finished | 4 | figures\nSubmitted | 1"} className={input} />
                </label>
                <div className="sm:col-span-2"><Button type="submit">Add goal</Button></div>
              </form>
            </details>

            <Rule />
            <Label>Projects</Label>
            {projects.length === 0 ? <p className="py-3 text-[14px] text-muted">No projects yet.</p> : projects.map((p) => <ProjectRow key={p.id} p={p} />)}
            <details className="mt-2">
              <summary className={summary}>+ Add project</summary>
              <form action={addProject} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="area" value={area.code} />
                <label className="flex flex-col gap-1 sm:col-span-2"><span className="label text-muted">Project (something with a finish line)</span><input name="title" required maxLength={200} placeholder="Revise figure 2" className={input} /></label>
                <label className="flex flex-col gap-1">
                  <span className="label text-muted">Serves goal</span>
                  <select name="goalId" defaultValue="" className={input}>
                    <option value="">None</option>
                    {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1"><span className="label text-muted">Deadline</span><input name="deadline" type="date" className={input} /></label>
                <div className="sm:col-span-2"><Button type="submit">Add project</Button></div>
              </form>
            </details>
          </Tile>
        ))}
      </div>
    </div>
  );
}
