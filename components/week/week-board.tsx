"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Tile } from "@/components/ui/tile";
import { Label, Mono, Rule } from "@/components/ui/label";
import { Meter } from "@/components/ui/meter";
import { Button } from "@/components/ui/button";
import {
  GRID_END_MIN,
  GRID_START_MIN,
  blockMinutes,
  clampStart,
  formatClock,
  layoutOverlaps,
  snap,
} from "@/lib/blocks";
import { formatHoursMinutes } from "@/lib/dates";
import { createFreeBlock, moveBlock, removeBlock, resizeBlock, scheduleTaskBlock } from "@/app/actions/blocks";
import type { BlockView } from "@/lib/services/blocks";

export type WeekDay = { key: string; label: string; short: string; isToday: boolean };
export type BacklogTask = { id: string; title: string; areaCode: string | null; estimateMin: number | null };
export type CalendarEvent = { id: string; day: string; startMin: number; endMin: number; title: string; allDay?: boolean };
type Kind = BlockView["kind"];

const PX = 0.8; // pixels per minute: 48 px an hour
const HEIGHT = (GRID_END_MIN - GRID_START_MIN) * PX;
const KINDS: Kind[] = ["deep", "shallow", "meeting", "personal", "recovery"];
const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];
const TIMES = Array.from({ length: (GRID_END_MIN - GRID_START_MIN) / 15 }, (_, i) => GRID_START_MIN + i * 15);

const kindClass: Record<Kind, string> = {
  deep: "border-[1.2px] border-text bg-paper text-text",
  shallow: "border border-dashed border-text bg-paper text-text",
  meeting: "bg-ink text-on-ink",
  personal: "border border-line bg-tile-2 text-text",
  recovery: "border border-dotted border-muted bg-transparent text-muted",
};

type Sheet =
  | { mode: "task"; task: BacklogTask; day: string; startMin: number }
  | { mode: "free"; day: string; startMin: number }
  | { mode: "block"; block: BlockView };

const fieldCls = "rounded-[8px] border border-line bg-transparent px-3 py-[10px] text-[15px]";

export function WeekBoard({
  days,
  blocks,
  events,
  backlog,
  tz,
  capacityMin,
  shutdownMin,
  areaCodes,
}: {
  days: WeekDay[];
  blocks: BlockView[];
  events: CalendarEvent[];
  backlog: BacklogTask[];
  tz: string;
  capacityMin: number;
  shutdownMin: number;
  areaCodes: string[];
}) {
  const todayIdx = Math.max(0, days.findIndex((d) => d.isToday));
  const [selected, setSelected] = useState(todayIdx);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [pending, start] = useTransition();
  const [nowMin, setNowMin] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
      const h = Number(parts.find((p) => p.type === "hour")?.value);
      const m = Number(parts.find((p) => p.type === "minute")?.value);
      setNowMin(h * 60 + m);
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [tz]);

  const byDay = useMemo(() => {
    const m = new Map<string, BlockView[]>();
    for (const d of days) m.set(d.key, []);
    for (const b of blocks) m.get(b.day)?.push(b);
    return m;
  }, [blocks, days]);
  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (!m.has(e.day)) m.set(e.day, []);
      m.get(e.day)!.push(e);
    }
    return m;
  }, [events]);

  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); setSheet(null); });

  function onDrop(e: React.DragEvent<HTMLDivElement>, day: string) {
    e.preventDefault();
    let data: { type: "task" | "block"; id: string; duration?: number; grab?: number } | null = null;
    try { data = JSON.parse(e.dataTransfer.getData("text/plain")); } catch { /* not ours */ }
    if (!data) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top - (data.grab ?? 0);
    const startMin = snap(GRID_START_MIN + y / PX);
    if (data.type === "task") {
      const t = backlog.find((x) => x.id === data!.id);
      start(async () => { await scheduleTaskBlock({ taskId: data!.id, day, startMin, durationMin: t?.estimateMin ?? 60 }); });
    } else {
      start(async () => { await moveBlock(data!.id, day, startMin); });
    }
  }

  const gridHours = Array.from({ length: (GRID_END_MIN - GRID_START_MIN) / 60 }, (_, i) => GRID_START_MIN / 60 + i);

  return (
    <div className="grid gap-[14px] lg:grid-cols-[240px_minmax(0,1fr)]">
      <Tile className="order-2 lg:order-1">
        <div className="flex justify-between">
          <Label>Backlog</Label>
          <Label>{backlog.length}</Label>
        </div>
        <Rule dotted />
        {backlog.length === 0 ? (
          <p className="py-3 text-[14px] text-muted">Everything open has a time. Capture more with C.</p>
        ) : (
          <ul className="max-h-[640px] overflow-auto">
            {backlog.map((t) => (
              <li
                key={t.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", JSON.stringify({ type: "task", id: t.id }));
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="leader flex cursor-grab items-center gap-2 py-[9px] text-[14px] active:cursor-grabbing"
              >
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                {t.areaCode ? <span className="label text-muted">{t.areaCode}</span> : null}
                {t.estimateMin ? <span className="mono text-muted">{formatHoursMinutes(t.estimateMin)}</span> : null}
                <button
                  type="button"
                  className="label rounded-full border border-line px-2 py-1 text-muted hover:border-text hover:text-text"
                  onClick={() => setSheet({ mode: "task", task: t, day: days[selected].key, startMin: 9 * 60 })}
                >
                  Time
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <Button onClick={() => setSheet({ mode: "free", day: days[selected].key, startMin: 9 * 60 })}>+ Block</Button>
        </div>
        <p className="label mt-4 hidden text-muted lg:block">Drag onto a day, or tap Time</p>
      </Tile>

      <Tile className="order-1 overflow-hidden lg:order-2">
        <div role="tablist" aria-label="Day" className="mb-3 flex gap-1 md:hidden">
          {days.map((d, i) => (
            <button
              key={d.key}
              role="tab"
              aria-selected={i === selected}
              onClick={() => setSelected(i)}
              className={`label flex-1 rounded-[8px] py-2 ${i === selected ? "bg-text text-paper" : "text-muted"} ${d.isToday && i !== selected ? "!text-orange" : ""}`}
            >
              {d.short}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[34px_minmax(0,1fr)] md:grid-cols-[34px_repeat(7,minmax(0,1fr))]">
          <div />
          {days.map((d, i) => {
            const total = (byDay.get(d.key) ?? []).reduce((a, b) => a + blockMinutes(b), 0);
            const late = (byDay.get(d.key) ?? []).some((b) => b.endMin > shutdownMin);
            const over = total > capacityMin || late;
            return (
              <div key={d.key} className={`${i === selected ? "block" : "hidden"} px-1 pb-2 md:block`}>
                <div className="flex items-baseline justify-between">
                  <Label className={d.isToday ? "!text-orange" : ""}>{d.label}</Label>
                  <Mono className={over ? "text-orange" : "text-muted"}>{formatHoursMinutes(total)}</Mono>
                </div>
                <div className="mt-1"><Meter value={total} max={capacityMin} label={`${d.label} scheduled`} /></div>
              </div>
            );
          })}

          <div className="relative" style={{ height: HEIGHT }} aria-hidden="true">
            {gridHours.map((h) => (
              <Mono key={h} className="absolute left-0 text-muted" style={{ top: (h * 60 - GRID_START_MIN) * PX - 6 }}>
                {String(h).padStart(2, "0")}
              </Mono>
            ))}
          </div>

          {days.map((d, i) => {
            const laid = layoutOverlaps((byDay.get(d.key) ?? []).map((b) => ({ ...b })));
            return (
              <div
                key={d.key}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                onDrop={(e) => onDrop(e, d.key)}
                onDoubleClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  setSheet({ mode: "free", day: d.key, startMin: clampStart(snap(GRID_START_MIN + (e.clientY - rect.top) / PX), 60) });
                }}
                className={`${i === selected ? "block" : "hidden"} relative border-l border-line md:block`}
                style={{ height: HEIGHT }}
                data-day={d.key}
              >
                {gridHours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line" style={{ top: (h * 60 - GRID_START_MIN) * PX }} />
                ))}

                {(eventsByDay.get(d.key) ?? []).filter((ev) => !ev.allDay).map((ev) => (
                  <div
                    key={ev.id}
                    className="pointer-events-none absolute inset-x-1 overflow-hidden rounded-[6px] bg-tile-2 px-[6px] py-[3px] text-[11px] leading-[1.25] text-muted"
                    style={{ top: (ev.startMin - GRID_START_MIN) * PX, height: Math.max(18, (ev.endMin - ev.startMin) * PX) }}
                    title={`${formatClock(ev.startMin)}–${formatClock(ev.endMin)} ${ev.title}`}
                  >
                    {ev.title}
                  </div>
                ))}

                {laid.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      e.dataTransfer.setData("text/plain", JSON.stringify({ type: "block", id: b.id, grab: e.clientY - rect.top }));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => setSheet({ mode: "block", block: b })}
                    className={`absolute overflow-hidden rounded-[6px] px-[6px] py-[3px] text-left text-[11px] leading-[1.25] ${kindClass[b.kind]} ${b.taskDone ? "opacity-50" : ""}`}
                    style={{
                      top: (b.startMin - GRID_START_MIN) * PX,
                      height: Math.max(18, (b.endMin - b.startMin) * PX - 1),
                      left: `calc(${(b.col / b.cols) * 100}% + 3px)`,
                      width: `calc(${100 / b.cols}% - 6px)`,
                    }}
                  >
                    <span className={b.taskDone ? "line-through" : ""}>{b.title}</span>
                    {b.endMin - b.startMin >= 45 ? (
                      <span className="mono block opacity-70">{formatClock(b.startMin)}{b.areaCode ? ` · ${b.areaCode}` : ""}</span>
                    ) : null}
                  </button>
                ))}

                {d.isToday && nowMin !== null && nowMin >= GRID_START_MIN && nowMin <= GRID_END_MIN ? (
                  <div className="pointer-events-none absolute inset-x-0 border-t-[1.5px] border-orange" style={{ top: (nowMin - GRID_START_MIN) * PX }} />
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="label mt-3 text-muted">Double-click an empty slot to add a block</p>
      </Tile>

      {sheet ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-3 md:items-center"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setSheet(null); }}
          onKeyDown={(e) => { if (e.key === "Escape") setSheet(null); }}
        >
          <div role="dialog" aria-label="Time block" className="w-full max-w-[460px] rounded-tile bg-paper p-5 text-text">
            {sheet.mode === "block" ? (
              <BlockSheet block={sheet.block} pending={pending} run={run} onClose={() => setSheet(null)} />
            ) : (
              <ScheduleSheet sheet={sheet} days={days} areaCodes={areaCodes} pending={pending} run={run} onClose={() => setSheet(null)} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScheduleSheet({
  sheet,
  days,
  areaCodes,
  pending,
  run,
  onClose,
}: {
  sheet: Extract<Sheet, { mode: "task" | "free" }>;
  days: WeekDay[];
  areaCodes: string[];
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
  onClose: () => void;
}) {
  const task = sheet.mode === "task" ? sheet.task : null;
  const [day, setDay] = useState(sheet.day);
  const [start, setStart] = useState(sheet.startMin);
  const [duration, setDuration] = useState(task?.estimateMin ?? 60);
  const [kind, setKind] = useState<Kind>("deep");
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (task) run(() => scheduleTaskBlock({ taskId: task.id, day, startMin: start, durationMin: duration, kind }));
    else if (title.trim()) run(() => createFreeBlock({ day, startMin: start, durationMin: duration, title, kind, areaCode: area || undefined }));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Label>{task ? "Schedule task" : "New block"}</Label>
        <button type="button" onClick={onClose} className="label text-muted hover:text-text">Close</button>
      </div>
      {task ? <p className="text-[16px]">{task.title}</p> : (
        <label className="flex flex-col gap-2">
          <span className="label text-muted">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Deep work, lunch, walk" className={fieldCls} />
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-2">
          <span className="label text-muted">Day</span>
          <select value={day} onChange={(e) => setDay(e.target.value)} className={fieldCls}>
            {days.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="label text-muted">Start</span>
          <select value={start} onChange={(e) => setStart(Number(e.target.value))} className={fieldCls}>
            {TIMES.map((m) => <option key={m} value={m}>{formatClock(m)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="label text-muted">Length</span>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={fieldCls}>
            {[...new Set([...DURATIONS, duration])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{formatHoursMinutes(m)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="label text-muted">Kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={fieldCls}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        {!task ? (
          <label className="col-span-2 flex flex-col gap-2">
            <span className="label text-muted">Area</span>
            <select value={area} onChange={(e) => setArea(e.target.value)} className={fieldCls}>
              <option value="">None</option>
              {areaCodes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <Button type="submit" variant="fill" disabled={pending || (!task && !title.trim())}>Schedule</Button>
    </form>
  );
}

function BlockSheet({
  block,
  pending,
  run,
  onClose,
}: {
  block: BlockView;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
  onClose: () => void;
}) {
  const duration = block.endMin - block.startMin;
  const nudge = "label rounded-full border border-line px-3 py-2 text-muted hover:border-text hover:text-text disabled:opacity-40";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Label>{block.kind}{block.areaCode ? ` · ${block.areaCode}` : ""}</Label>
        <button type="button" onClick={onClose} className="label text-muted hover:text-text">Close</button>
      </div>
      <p className="text-[18px] leading-[1.3]">{block.title}</p>
      <Mono className="text-muted">{block.day} · {formatClock(block.startMin)}–{formatClock(block.endMin)} · {formatHoursMinutes(duration)}</Mono>
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} className={nudge} onClick={() => run(() => moveBlock(block.id, block.day, block.startMin - 15))}>Earlier</button>
        <button disabled={pending} className={nudge} onClick={() => run(() => moveBlock(block.id, block.day, block.startMin + 15))}>Later</button>
        <button disabled={pending || duration <= 15} className={nudge} onClick={() => run(() => resizeBlock(block.id, duration - 15))}>Shorter</button>
        <button disabled={pending} className={nudge} onClick={() => run(() => resizeBlock(block.id, duration + 15))}>Longer</button>
      </div>
      <Button variant="quiet" disabled={pending} onClick={() => run(() => removeBlock(block.id))}>Remove block</Button>
    </div>
  );
}
