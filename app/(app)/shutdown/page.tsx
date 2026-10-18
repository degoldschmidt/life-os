import type { Metadata } from "next";
import { format } from "date-fns";
import { Tile } from "@/components/ui/tile";
import { Label, Mono, Rule } from "@/components/ui/label";
import { ThinNumber } from "@/components/ui/thin-number";
import { ButtonLink } from "@/components/ui/button";
import { OrangeDot } from "@/components/ui/dot";
import { ShutdownFlow, type Answers } from "@/components/shutdown/shutdown-flow";
import { requireUser } from "@/lib/auth";
import { addDaysToKey, dayKeyToDate, formatHoursMinutes, todayKey } from "@/lib/dates";
import { getSettings } from "@/lib/services/settings";
import { listHabitStatuses } from "@/lib/services/habits";
import { listDay, listInbox, listStale } from "@/lib/services/tasks";
import { getOrCreateDayReview, type DaySnapshot } from "@/lib/services/reviews";

export const metadata: Metadata = { title: "Daily shutdown" };

export default async function ShutdownPage() {
  const user = await requireUser();
  const settings = await getSettings();
  const today = todayKey(settings.tz, settings.dayStartHour);
  const tomorrow = addDaysToKey(today, 1, settings.tz);
  const review = await getOrCreateDayReview(user.id, today);
  const label = format(dayKeyToDate(today, settings.tz), "EEE d MMM");

  if (review.status === "final") {
    const snap = review.statsSnapshot as DaySnapshot;
    const top = (review.nextTop3 ?? []) as string[];
    return (
      <div className="grid gap-[14px] md:grid-cols-[260px_minmax(0,1fr)]">
        <Tile dark className="flex flex-col">
          <div className="flex justify-between">
            <Label>Daily shutdown</Label>
            <OrangeDot />
          </div>
          <Rule dotted className="mt-4" />
          <p className="mt-6 text-[22px] leading-[1.2]">Shutdown complete.</p>
          <p className="mt-2 text-[14px] text-muted">Work is done for today. Close the laptop.</p>
          <Mono className="mt-auto pt-6 text-muted">{label.toUpperCase()}</Mono>
        </Tile>
        <div className="flex flex-col gap-[14px]">
          <div className="grid gap-[14px] sm:grid-cols-3">
            <Tile>
              <Label>Tasks</Label>
              <ThinNumber size={56} className="mt-3" muted={`/${snap.tasksTotal ?? 0}`}>{snap.tasksDone ?? 0}</ThinNumber>
            </Tile>
            <Tile>
              <Label>Time done</Label>
              <ThinNumber size={56} className="mt-3">{formatHoursMinutes(snap.doneMin ?? 0)}</ThinNumber>
            </Tile>
            <Tile>
              <Label>Habits</Label>
              <ThinNumber size={56} className="mt-3" muted={`/${snap.habitsDue ?? 0}`}>{snap.habitsDone ?? 0}</ThinNumber>
            </Tile>
          </div>
          <Tile>
            <Label>Tomorrow&apos;s Top 3</Label>
            <Rule dotted />
            {top.length === 0 ? (
              <p className="text-[14px] text-muted">None chosen. Pick them in the morning.</p>
            ) : (
              <ol>
                {top.map((t, i) => (
                  <li key={t} className="mono flex gap-3 py-1 text-[13px]">
                    <span className="text-orange">{String(i + 1).padStart(2, "0")}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-5"><ButtonLink href="/today">Back to Today</ButtonLink></div>
          </Tile>
        </div>
      </div>
    );
  }

  const [dayTasks, stale, habits, tomorrowTasks, inbox] = await Promise.all([
    listDay(user.id, today),
    listStale(user.id, today),
    listHabitStatuses(user.id, today),
    listDay(user.id, tomorrow),
    listInbox(user.id),
  ]);

  const sweep = [
    ...dayTasks.filter((t) => t.status === "todo").map((t) => ({ id: t.id, title: t.title, areaCode: t.areaCode, estimateMin: t.estimateMin })),
    ...stale.map((t) => ({ id: t.id, title: t.title, areaCode: t.areaCode, estimateMin: t.estimateMin, stale: true })),
  ];
  const candidates = [
    ...tomorrowTasks.filter((t) => t.status === "todo"),
    ...inbox,
  ].map((t) => ({
    id: t.id,
    title: t.title,
    areaCode: t.areaCode,
    estimateMin: t.estimateMin,
    // Ranks only mean something for tomorrow's own list.
    planRank: tomorrowTasks.some((x) => x.id === t.id) ? t.planRank : null,
  }));
  const habitRows = habits
    .filter((h) => h.status.dueToday || h.status.doneToday)
    .map((h) => ({ id: h.id, name: h.name, done: h.status.doneToday, nudge: h.status.missedLastDue && !h.status.doneToday }));

  return (
    <ShutdownFlow
      reviewId={review.id}
      initialStep={review.currentStep}
      initialAnswers={review.answers as Answers}
      sweep={sweep}
      habits={habitRows}
      candidates={candidates}
      dateLabel={label}
    />
  );
}
