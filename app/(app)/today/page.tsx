import type { Metadata } from "next";
import { Tile } from "@/components/ui/tile";
import { Label, Mono, Rule } from "@/components/ui/label";
import { ThinNumber } from "@/components/ui/thin-number";
import { OrangeDot } from "@/components/ui/dot";
import { ButtonLink } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { dayKeyToDate, periodFor, todayKey } from "@/lib/dates";
import { getSettings } from "@/lib/services/settings";
import { format } from "date-fns";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const settings = await getSettings();
  const key = todayKey(settings.tz, settings.dayStartHour);
  const d = dayKeyToDate(key, settings.tz);
  const week = periodFor("week", key, settings.tz);

  return (
    <div className="grid gap-[14px] md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
      <Tile dark className="flex flex-col md:row-span-2">
        <div className="flex justify-between">
          <Label>{format(d, "EEE")} · {week.id.split("-")[1]}</Label>
          <OrangeDot />
        </div>
        <ThinNumber size={112} className="mt-5">{format(d, "d")}</ThinNumber>
        <Label className="mt-1 text-on-ink">{format(d, "MMMM yyyy")}</Label>
        <Rule dotted className="my-5" />
        <Label>Intention</Label>
        <p className="mt-2 text-[16px] leading-[1.35] text-muted">Set an intention when you plan the day.</p>
        <div className="mt-auto flex justify-between pt-6">
          <Mono className="text-muted">PLAN · PHASE 1</Mono>
          <Mono className="text-muted">SHUTDOWN {settings.shutdownTime}</Mono>
        </div>
      </Tile>

      <Tile>
        <div className="flex justify-between">
          <Label>Top 3</Label>
          <Label>Est.</Label>
        </div>
        <Rule dotted />
        <p className="py-6 text-[14px] text-muted">Nothing planned yet. Capture a task, then pick your three.</p>
        <div className="flex gap-[10px]">
          <ButtonLink href="/inbox">+ Capture</ButtonLink>
          <ButtonLink href="/inbox" variant="quiet">Inbox</ButtonLink>
        </div>
      </Tile>

      <Tile className="hidden xl:block xl:row-span-2">
        <div className="flex justify-between">
          <Label>Calendar</Label>
          <Label>Google · phase 4</Label>
        </div>
        <div className="relative mt-3 h-[420px]">
          {["09", "10", "11", "12", "14", "15"].map((h, i) => (
            <div key={h} className="hairline absolute inset-x-0 pt-[3px]" style={{ top: i * 70 }}>
              <Mono className="text-muted">{h}</Mono>
            </div>
          ))}
          <div className="absolute left-[38px] right-0 top-[356px] flex h-[52px] items-center justify-center rounded-[8px] border border-dashed border-muted">
            <Label>Drop a task here</Label>
          </div>
        </div>
      </Tile>

      <div className="grid gap-[14px] sm:grid-cols-2">
        <Tile>
          <Label>Planned</Label>
          <ThinNumber size={72} className="mt-4">0:00</ThinNumber>
          <Rule />
          <div className="mono flex justify-between"><span className="text-muted">CAPACITY</span><span>6:00</span></div>
          <div className="mt-3"><Meter value={0} max={360} label="Planned hours" /></div>
        </Tile>
        <Tile>
          <Label>Done</Label>
          <ThinNumber size={72} className="mt-4" muted="/0">0</ThinNumber>
          <Rule />
          <div className="mono flex justify-between"><span className="text-muted">DEEP WORK</span><span>0:00</span></div>
          <div className="mono mt-2 flex justify-between"><span className="text-muted">HABITS</span><span>—</span></div>
        </Tile>
      </div>
    </div>
  );
}
