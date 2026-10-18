import type { Metadata } from "next";
import { Tile } from "@/components/ui/tile";
import { Label, Mono } from "@/components/ui/label";
import { ButtonLink } from "@/components/ui/button";
import { TrendCharts } from "@/components/review/trend-charts";
import { requireUser } from "@/lib/auth";
import { loadTrends } from "@/lib/services/trends";

export const metadata: Metadata = { title: "Trends" };

export default async function TrendsPage() {
  const user = await requireUser();
  const trends = await loadTrends(user.id);
  return (
    <div className="flex flex-col gap-[14px]">
      <Tile dark className="flex flex-wrap items-center justify-between gap-4 !py-4">
        <div className="flex items-baseline gap-4">
          <Label>Trends</Label>
          <Mono className="text-muted">{trends.weeks.length} WEEKLY · {trends.days.length} DAILY · {trends.areaScores.length} QUARTERLY</Mono>
        </div>
        <ButtonLink href="/review" className="!border-on-ink !text-on-ink">Back to reviews</ButtonLink>
      </Tile>
      <TrendCharts trends={trends} />
    </div>
  );
}
