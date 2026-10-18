import type { Metadata } from "next";
import { Tile } from "@/components/ui/tile";
import { Label, Mono, Rule } from "@/components/ui/label";
import { OrangeDot } from "@/components/ui/dot";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { formatPeriodLabel, parsePeriodId, periodFor, todayKey, type Period, type ReviewType } from "@/lib/dates";
import { getSettings } from "@/lib/services/settings";
import { listReviews } from "@/lib/services/reviews";
import Link from "next/link";

export const metadata: Metadata = { title: "Review" };

const RITUALS: { type: Exclude<ReviewType, "day">; name: string; cadence: string; minutes: string }[] = [
  { type: "week", name: "Weekly review", cadence: "Every week", minutes: "25 min" },
  { type: "month", name: "Monthly review", cadence: "Every month", minutes: "30 min" },
  { type: "quarter", name: "Quarterly review", cadence: "Every quarter", minutes: "2 h" },
  { type: "year", name: "Annual review", cadence: "Every year", minutes: "1–2 h" },
];

export default async function ReviewHub() {
  const user = await requireUser();
  const settings = await getSettings();
  const today = todayKey(settings.tz, settings.dayStartHour);
  const all = await listReviews(user.id, ["day", "week", "month", "quarter", "year"], 80);

  const current = (type: Exclude<ReviewType, "day">) => periodFor(type, today, settings.tz);
  const statusOf = (type: Exclude<ReviewType, "day">) => all.find((r) => r.type === type && r.periodId === current(type).id);
  const archive = all.filter((r) => r.status === "final");
  const todayDay = all.find((r) => r.type === "day" && r.periodId === today);

  return (
    <div className="grid gap-[14px] xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-[14px]">
        <Tile dark className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3"><Label>Review</Label><OrangeDot /></div>
            <p className="mt-3 max-w-[460px] text-[16px] leading-[1.4]">Look back before you look ahead. The weekly review is the habit that keeps the rest honest.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/plan" className="!border-on-ink !text-on-ink">Daily plan</ButtonLink>
            <ButtonLink href="/shutdown" className="!border-on-ink !text-on-ink">{todayDay?.status === "final" ? "Shutdown done" : "Daily shutdown"}</ButtonLink>
          </div>
        </Tile>

        <div className="grid gap-[14px] sm:grid-cols-2">
          {RITUALS.map((r) => {
            const p = current(r.type);
            const rev = statusOf(r.type);
            const state = rev?.status === "final" ? "Complete" : rev ? `In progress · step ${rev.currentStep + 1}` : "Not started";
            return (
              <Tile key={r.type} className="flex flex-col">
                <div className="flex justify-between"><Label>{r.cadence}</Label><Label>{r.minutes}</Label></div>
                <h2 className="mt-3 text-[20px] font-normal leading-[1.15]">{r.name}</h2>
                <Mono className="mt-1 text-muted">{formatPeriodLabel(p, settings.tz).toUpperCase()}</Mono>
                <Mono className={`mt-3 ${rev?.status === "final" ? "text-muted" : rev ? "text-orange" : "text-muted"}`}>{state.toUpperCase()}</Mono>
                <div className="mt-5">
                  <ButtonLink href={`/review/${r.type}/${p.id}`} variant={rev?.status === "final" ? "quiet" : "outline"}>
                    {rev?.status === "final" ? "View" : rev ? "Continue" : "Start"}
                  </ButtonLink>
                </div>
              </Tile>
            );
          })}
        </div>
      </div>

      <Tile>
        <div className="flex justify-between"><Label>Archive</Label><Label>{archive.length}</Label></div>
        <Rule dotted />
        {archive.length === 0 ? (
          <p className="py-3 text-[14px] text-muted">Finished reviews collect here.</p>
        ) : (
          <ul>
            {archive.map((r) => {
              const p: Period | null = parsePeriodId(r.periodId, settings.tz);
              const href = r.type === "day" ? "/shutdown" : `/review/${r.type}/${r.periodId}`;
              return (
                <li key={r.id} className="leader py-3 last:border-b-0">
                  <Link href={r.type === "day" && r.periodId !== today ? `/journal?d=${r.periodId}` : href} className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px]">{p ? formatPeriodLabel(p, settings.tz) : r.periodId}</span>
                    <Label>{r.type}</Label>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Tile>
    </div>
  );
}
