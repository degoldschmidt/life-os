"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tile } from "@/components/ui/tile";
import { Label, Mono, Rule } from "@/components/ui/label";
import { OrangeDot } from "@/components/ui/dot";
import { Stepper } from "@/components/ui/stepper";
import { ThinNumber } from "@/components/ui/thin-number";
import { Meter } from "@/components/ui/meter";
import { Button } from "@/components/ui/button";
import { dropTask, planToday, planTomorrow, setEstimate, setTop, somedayTask } from "@/app/actions/tasks";
import { completePlan } from "@/app/actions/plan";
import { SuggestTop } from "@/components/ai/suggest-top";
import { formatHoursMinutes } from "@/lib/dates";

export type PlanTask = { id: string; title: string; areaCode: string | null; estimateMin: number | null; planRank: number | null };
export type Candidate = { id: string; title: string; areaCode: string | null; estimateMin: number | null; source: "stale" | "inbox" | "project" | "someday" };

const STEPS = ["Review", "Pull", "Shape", "Intention"];
const pill =
  "label rounded-full border border-line px-[10px] py-[6px] text-muted hover:border-text hover:text-text active:opacity-70 disabled:opacity-40";
const ESTIMATES = [15, 30, 60, 120];

export function PlanFlow({
  dateLabel,
  stale,
  pull,
  today,
  capacityMin,
  initialIntention,
  aiEnabled = false,
}: {
  dateLabel: string;
  stale: Candidate[];
  pull: Candidate[];
  today: PlanTask[];
  capacityMin: number;
  initialIntention: string;
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [intention, setIntention] = useState(initialIntention);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); });
  const finish = () => start(async () => { await completePlan(intention); router.push("/today"); });

  const planned = today.reduce((a, t) => a + (t.estimateMin ?? 0), 0);
  const unestimated = today.filter((t) => t.estimateMin == null).length;
  const over = planned > capacityMin;

  const row = (t: { id: string; title: string; areaCode: string | null; estimateMin: number | null }, actions: React.ReactNode) => (
    <div key={t.id} className="leader py-3 last:border-b-0">
      <div className="flex items-center gap-3 text-[14px]">
        <span className="min-w-0 flex-1 truncate">{t.title}</span>
        {t.areaCode ? <span className="label text-muted">{t.areaCode}</span> : null}
        {t.estimateMin ? <span className="mono text-muted">{formatHoursMinutes(t.estimateMin)}</span> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">{actions}</div>
    </div>
  );

  return (
    <div className="grid gap-[14px] md:grid-cols-[260px_minmax(0,1fr)]">
      <Tile dark className="flex flex-col">
        <div className="flex justify-between">
          <Label>Daily plan</Label>
          <OrangeDot />
        </div>
        <Rule dotted className="mt-4" />
        <ThinNumber size={64} className="mt-3 text-[#7a7a7a]">{String(step + 1).padStart(2, "0")}</ThinNumber>
        <Label className="mt-2 text-on-ink">{STEPS[step]}</Label>
        <Stepper steps={STEPS} current={step} />
        <div className="mt-auto pt-6">
          <Meter value={planned} max={capacityMin} label="Planned against capacity" />
          <div className="mono mt-2 flex justify-between text-muted">
            <span>{formatHoursMinutes(planned)} PLANNED</span>
            <span className={over ? "text-orange" : ""}>{formatHoursMinutes(capacityMin)} CAP</span>
          </div>
          <Mono className="mt-3 block text-muted">{dateLabel.toUpperCase()}</Mono>
        </div>
      </Tile>

      <Tile className="flex min-h-[420px] flex-col">
        {step === 0 ? (
          <>
            <Label>Review unfinished</Label>
            <p className="mt-2 text-[14px] text-muted">Left over from earlier days. Decide each one; nothing rolls over by itself.</p>
            <Rule dotted />
            {stale.length === 0 ? (
              <p className="py-6 text-[18px]">Nothing left over. A clean start.</p>
            ) : (
              stale.map((t) =>
                row(t, (
                  <>
                    <button disabled={pending} className={pill} onClick={() => run(() => planToday(t.id))}>Today</button>
                    <button disabled={pending} className={pill} onClick={() => run(() => planTomorrow(t.id))}>Tomorrow</button>
                    <button disabled={pending} className={pill} onClick={() => run(() => somedayTask(t.id))}>Someday</button>
                    <button disabled={pending} className={pill} onClick={() => run(() => dropTask(t.id))}>Drop</button>
                  </>
                )),
              )
            )}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Label>Pull into today</Label>
            <p className="mt-2 text-[14px] text-muted">From the Inbox, project next actions and Someday. Add only what you will really do.</p>
            <Rule dotted />
            {pull.length === 0 ? (
              <p className="py-6 text-[16px] text-muted">Inbox and Someday are empty.</p>
            ) : (
              pull.map((t) =>
                row(t, (
                  <>
                    <button disabled={pending} className={pill} onClick={() => run(() => planToday(t.id))}>Today</button>
                    <button disabled={pending} className={pill} onClick={() => run(() => planTomorrow(t.id))}>Tomorrow</button>
                    <span className="label self-center text-muted">{t.source}</span>
                  </>
                )),
              )
            )}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="flex justify-between">
              <Label>Shape the day</Label>
              <Label>{today.filter((t) => t.planRank != null).length}/3 top</Label>
            </div>
            <p className="mt-2 text-[14px] text-muted">Rank your Top 3 and give every task an estimate.</p>
            <Rule dotted />
            {aiEnabled && today.length > 0 ? (
              <SuggestTop
                which="today"
                titleOf={(id) => today.find((t) => t.id === id)?.title}
                onApply={async (ids) => { for (let i = 0; i < ids.length; i++) await setTop(ids[i], i + 1); }}
              />
            ) : null}
            {today.length === 0 ? (
              <p className="py-6 text-[16px] text-muted">Nothing planned. Go back and pull something in.</p>
            ) : (
              today.map((t) =>
                row(t, (
                  <>
                    {[1, 2, 3].map((r) => (
                      <button
                        key={r}
                        disabled={pending}
                        className={`${pill} ${t.planRank === r ? "!border-orange !text-orange" : ""}`}
                        onClick={() => run(() => setTop(t.id, t.planRank === r ? null : r))}
                      >
                        Top {r}
                      </button>
                    ))}
                    <span className="mx-1 w-px self-stretch bg-line" />
                    {ESTIMATES.map((m) => (
                      <button
                        key={m}
                        disabled={pending}
                        className={`${pill} ${t.estimateMin === m ? "!border-text !text-text" : ""}`}
                        onClick={() => run(() => setEstimate(t.id, m))}
                      >
                        {formatHoursMinutes(m)}
                      </button>
                    ))}
                  </>
                )),
              )
            )}
            {unestimated ? <p className="label mt-3 text-muted">{unestimated} without estimate</p> : null}
            {over ? <p className="label mt-2 text-orange">Over capacity by {formatHoursMinutes(planned - capacityMin)}. Cut something.</p> : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Label>Intention</Label>
            <Rule dotted />
            <label className="flex flex-col gap-3">
              <span className="text-[18px] leading-[1.3]">What would make today great?</span>
              <textarea
                rows={3}
                maxLength={300}
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                placeholder="Finish the figure 2 draft before anything else."
                className="rounded-[8px] border border-line bg-transparent px-3 py-[10px] text-[16px] leading-[1.5]"
              />
            </label>
            <p className="label mt-3 text-muted">Shown on Today. Leave empty to skip.</p>
          </>
        ) : null}

        <div className="mt-auto flex items-center justify-between pt-6">
          {step > 0 ? <Button variant="quiet" disabled={pending} onClick={() => setStep(step - 1)}>Back</Button> : <span />}
          {step < STEPS.length - 1 ? (
            <Button variant="fill" disabled={pending} onClick={() => setStep(step + 1)}>Continue →</Button>
          ) : (
            <Button variant="fill" disabled={pending} onClick={finish}>Plan the day</Button>
          )}
        </div>
      </Tile>
    </div>
  );
}
