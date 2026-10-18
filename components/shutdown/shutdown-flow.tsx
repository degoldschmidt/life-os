"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tile } from "@/components/ui/tile";
import { Label, Mono, Rule } from "@/components/ui/label";
import { OrangeDot } from "@/components/ui/dot";
import { Stepper } from "@/components/ui/stepper";
import { ThinNumber } from "@/components/ui/thin-number";
import { Button } from "@/components/ui/button";
import { HabitToggle } from "@/components/habits/habit-toggle";
import { dropTask, planTomorrow, setTopTomorrow, somedayTask, toggleDone } from "@/app/actions/tasks";
import { completeShutdown, saveShutdown } from "@/app/actions/shutdown";
import { SuggestTop } from "@/components/ai/suggest-top";
import { formatHoursMinutes } from "@/lib/dates";

export type SweepTask = { id: string; title: string; areaCode: string | null; estimateMin: number | null; stale?: boolean };
export type TomorrowTask = SweepTask & { planRank: number | null };
export type ShutdownHabit = { id: string; name: string; done: boolean; nudge: boolean };
export type Answers = { went_well?: string; fell_short?: string; better_tomorrow?: string; mood?: number; energy?: number };

const STEPS = ["Sweep", "Habits", "Tomorrow", "Reflect"];

const pill =
  "label rounded-full border border-line px-[10px] py-[6px] text-muted hover:border-text hover:text-text active:opacity-70 disabled:opacity-40";

export function ShutdownFlow({
  reviewId: _reviewId,
  initialStep,
  initialAnswers,
  sweep,
  habits,
  candidates,
  dateLabel,
  aiEnabled = false,
}: {
  reviewId: string;
  initialStep: number;
  initialAnswers: Answers;
  sweep: SweepTask[];
  habits: ShutdownHabit[];
  candidates: TomorrowTask[];
  dateLabel: string;
  aiEnabled?: boolean;
}) {
  void _reviewId;
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initialStep, STEPS.length - 1));
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); });

  function go(next: number) {
    setStep(next);
    start(async () => { await saveShutdown(next, answers); });
  }
  const finish = () => start(async () => { await completeShutdown(answers); router.refresh(); });

  const chosen = candidates.filter((t) => t.planRank != null).sort((a, b) => a.planRank! - b.planRank!);

  return (
    <div className="grid gap-[14px] md:grid-cols-[260px_minmax(0,1fr)]">
      <Tile dark className="flex flex-col">
        <div className="flex justify-between">
          <Label>Daily shutdown</Label>
          <OrangeDot />
        </div>
        <Rule dotted className="mt-4" />
        <ThinNumber size={64} className="mt-3 text-[#7a7a7a]">{String(step + 1).padStart(2, "0")}</ThinNumber>
        <Label className="mt-2 text-on-ink">{STEPS[step]}</Label>
        <Stepper steps={STEPS} current={step} />
        <Mono className="mt-auto pt-6 text-muted">{dateLabel.toUpperCase()} · SAVED AS YOU GO</Mono>
      </Tile>

      <Tile className="flex min-h-[420px] flex-col">
        {step === 0 ? (
          <>
            <Label>Sweep unfinished</Label>
            <p className="mt-2 text-[14px] text-muted">Decide for each: done, tomorrow, someday or drop. Nothing rolls over by itself.</p>
            <Rule dotted />
            {sweep.length === 0 ? (
              <p className="py-6 text-[18px]">Everything is settled.</p>
            ) : (
              sweep.map((t) => (
                <div key={t.id} className="leader py-3 last:border-b-0">
                  <div className="flex items-center gap-3 text-[14px]">
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    {t.stale ? <span className="label text-orange">Earlier</span> : null}
                    {t.areaCode ? <span className="label text-muted">{t.areaCode}</span> : null}
                    {t.estimateMin ? <span className="mono text-muted">{formatHoursMinutes(t.estimateMin)}</span> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button disabled={pending} className={pill} onClick={() => run(() => toggleDone(t.id, true))}>Done</button>
                    <button disabled={pending} className={pill} onClick={() => run(() => planTomorrow(t.id))}>Tomorrow</button>
                    <button disabled={pending} className={pill} onClick={() => run(() => somedayTask(t.id))}>Someday</button>
                    <button disabled={pending} className={pill} onClick={() => run(() => dropTask(t.id))}>Drop</button>
                  </div>
                </div>
              ))
            )}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Label>Habits</Label>
            <p className="mt-2 text-[14px] text-muted">Tick what you did today. Orange means yesterday was missed.</p>
            <Rule dotted />
            {habits.length === 0 ? (
              <p className="py-6 text-[16px] text-muted">No habits due today.</p>
            ) : (
              <ul className="flex flex-col gap-4 py-2">
                {habits.map((h) => (
                  <li key={h.id} className="flex items-center gap-4 text-[16px]">
                    <HabitToggle habitId={h.id} name={h.name} done={h.done} nudge={h.nudge} />
                    <span className={h.done ? "text-muted" : ""}>{h.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="flex justify-between">
              <Label>Tomorrow&apos;s Top 3</Label>
              <Label>{chosen.length}/3</Label>
            </div>
            <Rule dotted />
            {aiEnabled ? (
              <SuggestTop
                which="tomorrow"
                titleOf={(id) => candidates.find((c) => c.id === id)?.title}
                onApply={async (ids) => { for (let i = 0; i < ids.length; i++) await setTopTomorrow(ids[i], i + 1); }}
              />
            ) : null}
            {chosen.length ? (
              <ol className="mb-4">
                {chosen.map((t) => (
                  <li key={t.id} className="mono flex gap-3 py-1 text-[13px]">
                    <span className="text-orange">{String(t.planRank).padStart(2, "0")}</span>
                    <span className="text-text">{t.title}</span>
                  </li>
                ))}
              </ol>
            ) : null}
            <Label>Candidates</Label>
            {candidates.length === 0 ? (
              <p className="py-4 text-[14px] text-muted">Nothing waiting. Capture tasks with C, then come back.</p>
            ) : (
              candidates.map((t) => (
                <div key={t.id} className="leader py-3 last:border-b-0">
                  <div className="flex items-center gap-3 text-[14px]">
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    {t.areaCode ? <span className="label text-muted">{t.areaCode}</span> : null}
                    {t.estimateMin ? <span className="mono text-muted">{formatHoursMinutes(t.estimateMin)}</span> : null}
                  </div>
                  <div className="mt-2 flex gap-2">
                    {[1, 2, 3].map((r) => (
                      <button
                        key={r}
                        disabled={pending}
                        className={`${pill} ${t.planRank === r ? "!border-orange !text-orange" : ""}`}
                        onClick={() => run(() => setTopTomorrow(t.id, t.planRank === r ? null : r))}
                      >
                        Top {r}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Label>Reflect</Label>
            <Rule dotted />
            {(
              [
                ["went_well", "What went well today?"],
                ["fell_short", "Where did I fall short?"],
                ["better_tomorrow", "What will I do better tomorrow?"],
              ] as const
            ).map(([key, prompt]) => (
              <label key={key} className="mb-4 flex flex-col gap-2">
                <span className="text-[15px]">{prompt}</span>
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={answers[key] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))}
                  className="rounded-[8px] border border-line bg-transparent px-3 py-[10px] text-[15px] leading-[1.5]"
                />
              </label>
            ))}
            {(
              [
                ["mood", "Mood"],
                ["energy", "Energy"],
              ] as const
            ).map(([key, name]) => (
              <div key={key} className="mb-3">
                <Label>{name}</Label>
                <div className="mt-2 flex gap-2" role="radiogroup" aria-label={name}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={answers[key] === n}
                      onClick={() => setAnswers((a) => ({ ...a, [key]: n }))}
                      className={`mono flex-1 rounded-[8px] border py-[9px] ${answers[key] === n ? "border-text bg-text text-paper" : "border-line text-muted"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : null}

        <div className="mt-auto flex items-center justify-between pt-6">
          {step > 0 ? (
            <Button variant="quiet" disabled={pending} onClick={() => go(step - 1)}>Back</Button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <Button variant="fill" disabled={pending} onClick={() => go(step + 1)}>Continue →</Button>
          ) : (
            <Button variant="fill" disabled={pending} onClick={finish}>Shutdown complete</Button>
          )}
        </div>
      </Tile>
    </div>
  );
}
