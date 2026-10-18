import { Label, Mono } from "@/components/ui/label";
import { formatClock, layoutOverlaps } from "@/lib/blocks";
import type { BlockView } from "@/lib/services/blocks";
import type { CalendarEventView } from "@/lib/services/calendar";

const FROM = 7 * 60;
const TO = 21 * 60;
const PX = 0.5; // 30 px an hour: 14 hours in 420 px

/** Today's calendar column: Google events (grey) and your own time blocks (outlined), with a now line. */
export function DayRail({
  events,
  blocks,
  nowMin,
  connected,
}: {
  events: CalendarEventView[];
  blocks: BlockView[];
  nowMin: number;
  connected: boolean;
}) {
  const timed = events.filter((e) => !e.allDay);
  const allDay = events.filter((e) => e.allDay);
  const laid = layoutOverlaps([
    ...timed.map((e) => ({ id: e.id, startMin: e.startMin, endMin: e.endMin, title: e.title, own: false })),
    ...blocks.map((b) => ({ id: b.id, startMin: b.startMin, endMin: b.endMin, title: b.title, own: true })),
  ]);
  const hours = Array.from({ length: (TO - FROM) / 60 }, (_, i) => FROM / 60 + i);
  const clamp = (m: number) => Math.max(FROM, Math.min(TO, m));

  return (
    <div>
      <div className="flex justify-between">
        <Label>Calendar</Label>
        <Label>{connected ? "Google · synced" : "Not connected"}</Label>
      </div>
      {allDay.length ? (
        <ul className="mt-2 flex flex-wrap gap-1">
          {allDay.map((e) => <li key={e.id} className="label rounded-full bg-tile-2 px-2 py-1 text-muted">{e.title}</li>)}
        </ul>
      ) : null}
      <div className="relative mt-3" style={{ height: (TO - FROM) * PX }}>
        {hours.map((h) => (
          <div key={h} className="hairline absolute inset-x-0 pt-[2px]" style={{ top: (h * 60 - FROM) * PX }}>
            <Mono className="text-muted">{String(h).padStart(2, "0")}</Mono>
          </div>
        ))}
        {laid.map((it) => (
          <div
            key={it.id}
            className={`absolute overflow-hidden rounded-[6px] px-2 py-[3px] text-[11px] leading-[1.25] ${it.own ? "border-[1.2px] border-text bg-paper" : "bg-tile-2 text-muted"}`}
            style={{
              top: (clamp(it.startMin) - FROM) * PX,
              height: Math.max(16, (clamp(it.endMin) - clamp(it.startMin)) * PX - 1),
              left: `calc(36px + (100% - 36px) * ${it.col / it.cols})`,
              width: `calc((100% - 36px) / ${it.cols} - 2px)`,
            }}
            title={`${formatClock(it.startMin)}–${formatClock(it.endMin)} ${it.title}`}
          >
            {it.title}
          </div>
        ))}
        {nowMin >= FROM && nowMin <= TO ? (
          <div className="absolute inset-x-0 border-t-[1.5px] border-orange" style={{ top: (nowMin - FROM) * PX }} />
        ) : null}
      </div>
      {!connected ? <p className="label mt-3 text-muted">Connect Google Calendar in Settings</p> : null}
    </div>
  );
}
