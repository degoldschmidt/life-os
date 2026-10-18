import type { Metadata } from "next";
import Link from "next/link";
import { Tile } from "@/components/ui/tile";
import { Label, Mono, Rule } from "@/components/ui/label";
import { ThinNumber } from "@/components/ui/thin-number";
import { DumpImport } from "@/components/import/dump-import";
import { SetupForm } from "@/components/setup/setup-form";
import { requireUser } from "@/lib/auth";
import { aiAvailable } from "@/lib/ai/run";
import { listAreas } from "@/lib/services/areas";
import { setupProgress } from "@/lib/services/setup";
import { addGoalsBatch, addHabitsBatch, saveAllAreas } from "@/app/actions/setup";

export const metadata: Metadata = { title: "Setup" };

const input = "w-full rounded-[8px] border border-line bg-transparent px-3 py-[9px] text-[14px]";

export default async function SetupPage() {
  const user = await requireUser();
  const [areas, progress] = await Promise.all([listAreas(user.id), setupProgress(user.id)]);
  const codes = areas.map((a) => a.code);

  return (
    <div className="flex flex-col gap-[14px]">
      <Tile dark className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Label>Setup</Label>
          <p className="mt-3 max-w-[520px] text-[16px] leading-[1.4]">Ten minutes, top to bottom. Each section saves on its own, so stop and come back whenever you like.</p>
        </div>
        <div className="mono flex flex-wrap gap-x-6 gap-y-1 text-muted">
          <span>{progress.goals} GOALS</span><span>{progress.habits} HABITS</span><span>{progress.projects} PROJECTS</span><span>{progress.tasks} OPEN TASKS</span>
        </div>
      </Tile>

      <Tile>
        <div className="flex items-baseline gap-4"><ThinNumber size={44}>01</ThinNumber><h2 className="text-[22px] font-normal">Your areas, in your words</h2></div>
        <p className="mt-2 text-[14px] text-muted">A standard says what &ldquo;good enough&rdquo; looks like in that part of life. The weekly hours are what you want to spend there; the weekly review compares reality against them.</p>
        <Rule dotted />
        <SetupForm action={saveAllAreas} submit="Save areas">
          <div className="grid gap-5 md:grid-cols-2">
            {areas.map((a) => (
              <div key={a.code} className="flex flex-col gap-2">
                <Mono className="text-muted">{a.code}</Mono>
                <input name={`name_${a.code}`} defaultValue={a.name} aria-label={`${a.code} name`} className={input} />
                <textarea name={`standard_${a.code}`} rows={2} defaultValue={a.standard ?? ""} aria-label={`${a.code} standard`} placeholder="What does good look like here?" className={input} />
                <label className="flex items-center gap-3 text-[13px] text-muted">
                  Hours a week
                  <input name={`hours_${a.code}`} type="number" step="0.5" min={0} max={100} defaultValue={a.weeklyTargetHours ?? ""} className={`${input} !w-24`} />
                </label>
              </div>
            ))}
          </div>
        </SetupForm>
      </Tile>

      <Tile>
        <div className="flex items-baseline gap-4"><ThinNumber size={44}>02</ThinNumber><h2 className="text-[22px] font-normal">One goal per area for this quarter</h2></div>
        <p className="mt-2 text-[14px] text-muted">Leave an area empty if nothing is pressing. Key results are optional, one per line as <Mono>metric | target | unit</Mono>, up to three.</p>
        <Rule dotted />
        <SetupForm action={addGoalsBatch} submit="Add goals">
          <div className="grid gap-5 md:grid-cols-2">
            {areas.map((a) => (
              <div key={a.code} className="flex flex-col gap-2">
                <Mono className="text-muted">{a.code} · {a.name}</Mono>
                <input name={`goal_${a.code}`} aria-label={`${a.code} goal`} maxLength={200} placeholder="Submit the connectivity paper" className={input} />
                <textarea name={`krs_${a.code}`} rows={2} aria-label={`${a.code} key results`} placeholder={"Figures finished | 4 | figures\nSubmitted | 1"} className={input} />
              </div>
            ))}
          </div>
        </SetupForm>
      </Tile>

      <Tile>
        <div className="flex items-baseline gap-4"><ThinNumber size={44}>03</ThinNumber><h2 className="text-[22px] font-normal">Habits worth tracking</h2></div>
        <p className="mt-2 text-[14px] text-muted">Up to five, small enough for your worst day. {progress.habits ? `You already have ${progress.habits}.` : ""}</p>
        <Rule dotted />
        <SetupForm action={addHabitsBatch} submit="Add habits">
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_110px]">
                <input name={`habit_${i}`} aria-label={`Habit ${i + 1}`} maxLength={80} placeholder={["Stretch for 5 minutes", "Read 20 minutes", "Message a friend", "", ""][i]} className={input} />
                <select name={`rhythm_${i}`} defaultValue="daily" aria-label={`Habit ${i + 1} rhythm`} className={input}>
                  <option value="daily">Every day</option><option value="weekdays">Weekdays</option><option value="weekly">Once a week</option>
                </select>
                <select name={`habit_area_${i}`} defaultValue="" aria-label={`Habit ${i + 1} area`} className={input}>
                  <option value="">No area</option>{codes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
          </div>
        </SetupForm>
      </Tile>

      <Tile>
        <div className="flex items-baseline gap-4"><ThinNumber size={44}>04</ThinNumber><h2 className="text-[22px] font-normal">Everything else: brain dump</h2></div>
        <p className="mt-2 text-[14px] text-muted">
          Paste tasks, projects, goals, habits, fragments from an email or a note, in any order. {aiAvailable() ? "Claude sorts it into the right places" : "Each line becomes a task; add an Anthropic key for smart sorting"}, and you approve before anything is saved.
        </p>
        <Rule dotted />
        <DumpImport areaCodes={codes} />
      </Tile>

      <Tile>
        <div className="flex items-baseline gap-4"><ThinNumber size={44}>05</ThinNumber><h2 className="text-[22px] font-normal">Bring in what you already have</h2></div>
        <p className="mt-2 text-[14px] text-muted">Notion pages and databases, Apple Notes, Markdown files, or ask Claude Code to add things for you.</p>
        <Rule dotted />
        <div className="flex flex-wrap gap-3">
          <Link href="/import" className="inline-flex rounded-full border-[1.2px] border-text px-[18px] py-[9px] font-mono text-[12px] uppercase tracking-[0.04em]">Import notes</Link>
          <Link href="/plan" className="inline-flex rounded-full border-[1.2px] border-text bg-text px-[18px] py-[9px] font-mono text-[12px] uppercase tracking-[0.04em] text-paper">Plan your first day →</Link>
        </div>
      </Tile>
    </div>
  );
}
