import type { Metadata } from "next";
import { format } from "date-fns";
import { PlanFlow } from "@/components/plan/plan-flow";
import { aiAvailable } from "@/lib/ai/run";
import { requireUser } from "@/lib/auth";
import { dayKeyToDate, todayKey } from "@/lib/dates";
import { getSettings } from "@/lib/services/settings";
import { getMorningIntention } from "@/lib/services/journal";
import { listAnytime, listDay, listInbox, listSomeday, listStale, materializeRecurring } from "@/lib/services/tasks";

export const metadata: Metadata = { title: "Daily plan" };

export default async function PlanPage() {
  const user = await requireUser();
  const settings = await getSettings();
  const today = todayKey(settings.tz, settings.dayStartHour);
  await materializeRecurring(user.id, today);

  const [stale, inbox, anytime, someday, dayTasks, intention] = await Promise.all([
    listStale(user.id, today),
    listInbox(user.id),
    listAnytime(user.id),
    listSomeday(user.id),
    listDay(user.id, today),
    getMorningIntention(user.id, today),
  ]);

  const pick = (t: { id: string; title: string; areaCode: string | null; estimateMin: number | null }) => ({
    id: t.id,
    title: t.title,
    areaCode: t.areaCode,
    estimateMin: t.estimateMin,
  });

  return (
    <PlanFlow
      dateLabel={format(dayKeyToDate(today, settings.tz), "EEE d MMM")}
      stale={stale.map((t) => ({ ...pick(t), source: "stale" as const }))}
      pull={[
        ...inbox.map((t) => ({ ...pick(t), source: "inbox" as const })),
        ...anytime.map((t) => ({ ...pick(t), source: "project" as const })),
        ...someday.map((t) => ({ ...pick(t), source: "someday" as const })),
      ]}
      today={dayTasks
        .filter((t) => t.status === "todo")
        .map((t) => ({ ...pick(t), planRank: t.planRank }))}
      capacityMin={settings.dailyCapacityMin}
      initialIntention={intention ?? ""}
      aiEnabled={aiAvailable()}
    />
  );
}
