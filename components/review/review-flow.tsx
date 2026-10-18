"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tile } from "@/components/ui/tile";
import { Label, Mono, Rule } from "@/components/ui/label";
import { OrangeDot } from "@/components/ui/dot";
import { Stepper } from "@/components/ui/stepper";
import { ThinNumber } from "@/components/ui/thin-number";
import { DotGrid } from "@/components/ui/dot-grid";
import { Button } from "@/components/ui/button";
import { TaskRow, type TaskView } from "@/components/tasks/task-row";
import { StatsPanel } from "@/components/review/stats-panel";
import { dumpToInbox, finishReview, saveReviewProgress } from "@/app/actions/review";
import { dotsFor } from "@/lib/goals";
import type { ReviewQuestion } from "@/lib/db/schema";
import type { PeriodStats } from "@/lib/services/stats";

export type FlowStep = { id: string; title: string; questions: ReviewQuestion[] };
export type FlowArea = { code: string; name: string; standard: string | null };
type Answers = Record<string, unknown>;

const TYPE_LABEL: Record<string, string> = { week: "Weekly review", month: "Monthly review", quarter: "Quarterly review", year: "Annual review" };
const field = "w-full rounded-[8px] border border-line bg-transparent px-3 py-[10px] text-[15px] leading-[1.5]";

/** Which working view sits above a step's questions. */
function panelFor(type: string, stepId: string): "inbox" | "stats" | "goals" | null {
  if (type === "week") return stepId === "clear" ? "inbox" : stepId === "look_back" ? "stats" : stepId === "goals" ? "goals" : null;
  if (type === "month") return stepId === "month" ? "stats" : stepId === "goals" ? "goals" : null;
  if (type === "quarter") return stepId === "areas" ? "stats" : stepId === "goals" ? "goals" : null;
  if (type === "year") return stepId === "past_year" ? "stats" : null;
  return null;
}

export function ReviewFlow({
  type,
  periodId,
  periodLabel,
  steps,
  initialStep,
  initialAnswers,
  stats,
  areas,
  inbox,
}: {
  type: "week" | "month" | "quarter" | "year";
  periodId: string;
  periodLabel: string;
  steps: FlowStep[];
  initialStep: number;
  initialAnswers: Answers;
  stats: PeriodStats;
  areas: FlowArea[];
  inbox: TaskView[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initialStep, steps.length - 1));
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [dump, setDump] = useState("");
  const [dumped, setDumped] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const current = steps[step];
  const panel = panelFor(type, current.id);
  const set = (key: string, value: unknown) => setAnswers((a) => ({ ...a, [key]: value }));
  /** Update one answer from its latest value, so quick successive edits never overwrite each other. */
  const merge = <T,>(key: string, fallback: T, fn: (cur: T) => T) =>
    setAnswers((a) => ({ ...a, [key]: fn((a[key] as T | undefined) ?? fallback) }));

  const go = (next: number) => { setStep(next); start(async () => { await saveReviewProgress(type, periodId, next, answers); }); };
  const finish = () => start(async () => { await finishReview(type, periodId, answers); router.refresh(); });

  function renderQuestion(q: ReviewQuestion) {
    if (q.kind === "text") {
      return (
        <label key={q.id} className="mb-5 flex flex-col gap-2">
          <span className="text-[16px] leading-[1.35]">{q.prompt}</span>
          <textarea rows={3} maxLength={4000} value={(answers[q.id] as string) ?? ""} onChange={(e) => set(q.id, e.target.value)} className={field} />
        </label>
      );
    }
    if (q.kind === "scale") {
      const max = q.max ?? 5;
      return (
        <div key={q.id} className="mb-5">
          <span className="text-[16px]">{q.prompt}</span>
          <div className="mt-2 flex gap-2" role="radiogroup" aria-label={q.prompt}>
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" role="radio" aria-checked={answers[q.id] === n} onClick={() => set(q.id, answers[q.id] === n ? null : n)}
                className={`mono flex-1 rounded-[8px] border py-[9px] ${answers[q.id] === n ? "border-text bg-text text-paper" : "border-line text-muted"}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (q.kind === "area_scores") {
      if (q.id === "area_standards") {
        const cur = (answers.area_standards as Record<string, string> | undefined) ?? {};
        return (
          <div key={q.id} className="mb-5">
            <span className="text-[16px]">{q.prompt}</span>
            {areas.map((a) => (
              <label key={a.code} className="mt-3 flex flex-col gap-1">
                <span className="label text-muted">{a.code} · {a.name}</span>
                <textarea rows={2} maxLength={300} value={cur[a.code] ?? a.standard ?? ""} onChange={(e) => merge<Record<string, string>>("area_standards", {}, (c) => ({ ...c, [a.code]: e.target.value }))} className={field} />
              </label>
            ))}
          </div>
        );
      }
      const cur = (answers.area_scores as Record<string, number> | undefined) ?? {};
      return (
        <div key={q.id} className="mb-5">
          <span className="text-[16px]">{q.prompt}</span>
          {areas.map((a) => (
            <div key={a.code} className="mt-3">
              <Label>{a.code} · {a.name}</Label>
              <div className="mt-2 flex gap-1" role="radiogroup" aria-label={`${a.name} score`}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={cur[a.code] === n} onClick={() => merge<Record<string, number>>("area_scores", {}, (c) => ({ ...c, [a.code]: n }))}
                    className={`mono flex-1 rounded-[6px] border py-2 text-[12px] ${cur[a.code] === n ? "border-text bg-text text-paper" : "border-line text-muted"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (q.kind === "top3") {
      const cur = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
      return (
        <div key={q.id} className="mb-5">
          <span className="text-[16px]">{q.prompt}</span>
          {[0, 1, 2].map((i) => (
            <label key={i} className="mt-2 flex items-center gap-3">
              <Mono className="w-6 text-orange">{String(i + 1).padStart(2, "0")}</Mono>
              <input value={cur[i] ?? ""} maxLength={200} onChange={(e) => merge<string[]>(q.id, [], (c) => { const next = [0, 1, 2].map((j) => c[j] ?? ""); next[i] = e.target.value; return next; })} className={field} />
            </label>
          ))}
        </div>
      );
    }
    // checklist
    return (
      <label key={q.id} className="mb-4 flex items-start gap-3 text-[15px]">
        <input type="checkbox" checked={answers[q.id] === true} onChange={(e) => set(q.id, e.target.checked)} className="mt-[5px] h-4 w-4 accent-[var(--text)]" />
        <span>{q.prompt}</span>
      </label>
    );
  }

  return (
    <div className="grid gap-[14px] md:grid-cols-[260px_minmax(0,1fr)]">
      <Tile dark className="flex flex-col">
        <div className="flex justify-between"><Label>{TYPE_LABEL[type]}</Label><OrangeDot /></div>
        <Rule dotted className="mt-4" />
        <ThinNumber size={64} className="mt-3 text-[#7a7a7a]">{String(step + 1).padStart(2, "0")}</ThinNumber>
        <Label className="mt-2 text-on-ink">{current.title}</Label>
        <Stepper steps={steps.map((s) => s.title)} current={step} />
        <Mono className="mt-auto pt-6 text-muted">{periodLabel.toUpperCase()} · SAVED AS YOU GO</Mono>
      </Tile>

      <Tile className="flex min-h-[440px] flex-col">
        <h2 className="text-[24px] font-normal leading-[1.15]">{current.title}</h2>
        <Rule dotted />

        {panel === "inbox" ? (
          <div className="mb-6">
            <div className="flex justify-between"><Label>Inbox</Label><Label>{inbox.length}</Label></div>
            {inbox.length === 0 ? <p className="py-3 text-[14px] text-muted">Inbox is empty.</p> : inbox.map((t, i) => <TaskRow key={t.id} task={t} mode="inbox" index={i + 1} />)}
            <Label className="mt-5 block">Brain dump: one thing per line</Label>
            <textarea rows={4} value={dump} onChange={(e) => setDump(e.target.value)} placeholder={"email Anna about the review #WRK\nbook dentist tomorrow\nrenew passport due 30 nov #FIN"} className={`${field} mt-2`} />
            <div className="mt-2 flex items-center gap-3">
              <Button
                variant="quiet"
                disabled={pending || !dump.trim()}
                onClick={() => start(async () => { const r = await dumpToInbox(dump); setDump(""); setDumped(r.added); router.refresh(); })}
              >
                Add to Inbox
              </Button>
              {dumped != null ? <Mono className="text-muted">{dumped} ADDED</Mono> : null}
            </div>
          </div>
        ) : null}

        {panel === "stats" ? <div className="mb-6"><StatsPanel stats={stats} /></div> : null}

        {panel === "goals" ? (
          <div className="mb-6">
            {stats.goals.length === 0 ? (
              <p className="py-2 text-[14px] text-muted">No active goals. <Link href="/goals" className="underline">Add one</Link>.</p>
            ) : (
              stats.goals.map((g) => (
                <div key={g.id} className="leader flex flex-wrap items-center gap-4 py-3 last:border-b-0">
                  <span className="min-w-[180px] flex-1 text-[14px]">{g.title} <span className="label text-muted">{g.areaCode}</span></span>
                  <DotGrid total={21} filled={dotsFor(g.progress)} label={`${Math.round((g.progress ?? 0) * 100)}%`} />
                  <Mono className="text-muted">{g.confidence != null ? `CONF ${g.confidence}/10` : "NO CONFIDENCE"}</Mono>
                </div>
              ))
            )}
            <p className="label mt-3 text-muted"><Link href="/goals" className="underline">Update key results on Goals</Link>. Your answers here are saved.</p>
          </div>
        ) : null}

        {current.questions.map(renderQuestion)}

        <div className="mt-auto flex items-center justify-between pt-6">
          {step > 0 ? <Button variant="quiet" disabled={pending} onClick={() => go(step - 1)}>Back</Button> : <span />}
          {step < steps.length - 1 ? (
            <Button variant="fill" disabled={pending} onClick={() => go(step + 1)}>Continue →</Button>
          ) : (
            <Button variant="fill" disabled={pending} onClick={finish}>Finish review</Button>
          )}
        </div>
      </Tile>
    </div>
  );
}
