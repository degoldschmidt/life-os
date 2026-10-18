import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Tile } from "@/components/ui/tile";
import { Label, Mono, Rule } from "@/components/ui/label";
import { OrangeDot } from "@/components/ui/dot";
import { Button, ButtonLink } from "@/components/ui/button";
import { ReviewFlow, type FlowStep } from "@/components/review/review-flow";
import { StatsPanel } from "@/components/review/stats-panel";
import { reopenReviewAction } from "@/app/actions/review";
import { requireUser } from "@/lib/auth";
import { formatPeriodLabel, parsePeriodId, periodFor } from "@/lib/dates";
import { getSettings } from "@/lib/services/settings";
import { listAreas } from "@/lib/services/areas";
import { getOrCreateReview } from "@/lib/services/reviews";
import { computePeriodStats, type PeriodStats } from "@/lib/services/stats";
import { listInbox } from "@/lib/services/tasks";

export const metadata: Metadata = { title: "Review" };

const TYPES = ["week", "month", "quarter", "year"] as const;
type T = (typeof TYPES)[number];

function show(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Done" : "No";
  if (Array.isArray(value)) return value.filter(Boolean).map((v, i) => `${i + 1}. ${v}`).join("\n") || "—";
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}: ${v}`).join("   ");
  return String(value);
}

export default async function ReviewPage({ params }: { params: Promise<{ type: string; period: string }> }) {
  const { type, period: periodId } = await params;
  if (!TYPES.includes(type as T)) notFound();
  const t = type as T;
  const user = await requireUser();
  const settings = await getSettings();
  const period = parsePeriodId(periodId, settings.tz);
  if (!period || period.type !== t) notFound();

  const { review, template } = await getOrCreateReview(user.id, t, period);
  const steps = template.steps as FlowStep[];
  const label = formatPeriodLabel(period, settings.tz);
  const goalPeriods = [periodFor("quarter", period.start, settings.tz).id, periodFor("year", period.start, settings.tz).id];

  const final = review.status === "final";
  // A finished review shows the numbers as they were; an open one shows them live.
  const stats: PeriodStats = final && Object.keys(review.statsSnapshot).length
    ? (review.statsSnapshot as unknown as PeriodStats)
    : await computePeriodStats(user.id, period, settings.tz, goalPeriods);

  if (!final) {
    const [areas, inbox] = await Promise.all([listAreas(user.id), t === "week" ? listInbox(user.id) : Promise.resolve([])]);
    return (
      <ReviewFlow
        type={t}
        periodId={period.id}
        periodLabel={label}
        steps={steps}
        initialStep={review.currentStep}
        initialAnswers={review.answers as Record<string, unknown>}
        stats={stats}
        areas={areas.map((a) => ({ code: a.code, name: a.name, standard: a.standard }))}
        inbox={inbox.map((x) => ({ id: x.id, title: x.title, areaCode: x.areaCode, estimateMin: x.estimateMin, status: x.status, planRank: x.planRank, deadline: x.deadline }))}
      />
    );
  }

  const answers = review.answers as Record<string, unknown>;
  const top = (review.nextTop3 ?? []) as string[];
  return (
    <div className="grid gap-[14px] md:grid-cols-[260px_minmax(0,1fr)]">
      <Tile dark className="flex flex-col">
        <div className="flex justify-between"><Label>{t} review</Label><OrangeDot /></div>
        <Rule dotted className="mt-4" />
        <p className="mt-6 text-[22px] leading-[1.2]">Review complete.</p>
        <Mono className="mt-2 text-muted">{label.toUpperCase()}</Mono>
        {top.length ? (
          <div className="mt-6">
            <Label>Next</Label>
            <ol className="mt-2">
              {top.map((x, i) => (
                <li key={i} className="mono flex gap-3 py-1 text-[13px]"><span className="text-orange">{String(i + 1).padStart(2, "0")}</span><span>{x}</span></li>
              ))}
            </ol>
          </div>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2 pt-6">
          <ButtonLink href="/review" className="!border-on-ink !text-on-ink">All reviews</ButtonLink>
          <form action={reopenReviewAction.bind(null, t, period.id)}><Button type="submit" variant="quiet">Reopen</Button></form>
        </div>
      </Tile>
      <div className="flex flex-col gap-[14px]">
        <Tile><Label>Look back</Label><Rule dotted /><StatsPanel stats={stats} showProjects={false} /></Tile>
        <Tile>
          <Label>Your answers</Label>
          <Rule dotted />
          {steps.flatMap((s) => s.questions).filter((q) => q.kind !== "checklist").map((q) => (
            <div key={q.id} className="leader py-3 last:border-b-0">
              <p className="label text-muted">{q.prompt}</p>
              <p className="mt-1 whitespace-pre-wrap text-[15px] leading-[1.5]">{show(answers[q.id])}</p>
            </div>
          ))}
        </Tile>
      </div>
    </div>
  );
}
