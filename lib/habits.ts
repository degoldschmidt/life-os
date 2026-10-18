import type { HabitSchedule } from "@/lib/db/schema";
import { addDays, isoWeekday } from "@/lib/recurrence";
import type { DayKey } from "@/lib/dates";

export const MAX_ACTIVE_HABITS = 5;
export const GRID_DAYS = 14;

export type GridCell = { day: DayKey; due: boolean; done: boolean; today: boolean };

export type HabitStatus = {
  /** Should it be done today? Weekly-count habits stay due until the weekly target is met. */
  dueToday: boolean;
  doneToday: boolean;
  /** The most recent day it was due before today was missed: nudge "don't miss twice". */
  missedLastDue: boolean;
  /** Last 14 days, oldest first, ending today. */
  grid: GridCell[];
  /** Completion over the window: done ÷ due, null when nothing was due. */
  rate: number | null;
  doneInWindow: number;
  dueInWindow: number;
};

function weekStart(day: DayKey): DayKey {
  return addDays(day, -(isoWeekday(day) - 1));
}

function isDayScheduled(schedule: HabitSchedule, day: DayKey): boolean {
  return "days" in schedule ? schedule.days.includes(isoWeekday(day)) : true;
}

/**
 * Status of one habit as of `today`.
 *
 * Fixed-days habits are due on their weekdays. Habits with a weekly count (perWeek: n)
 * are due on any day until n completions exist in the ISO week, and their rate is
 * measured against n per week instead of per day.
 */
export function habitStatus(schedule: HabitSchedule, doneDays: Set<DayKey>, today: DayKey): HabitStatus {
  const days: DayKey[] = [];
  for (let i = GRID_DAYS - 1; i >= 0; i--) days.push(addDays(today, -i));

  const countInWeek = (day: DayKey) => {
    const start = weekStart(day);
    let n = 0;
    for (let i = 0; i < 7; i++) if (doneDays.has(addDays(start, i))) n++;
    return n;
  };

  const weekly = "perWeek" in schedule;
  const target = weekly ? Math.max(1, schedule.perWeek) : 0;

  const grid: GridCell[] = days.map((day) => {
    const done = doneDays.has(day);
    // For weekly-count habits, a day only "counts as due" if the week's target was not yet met when it started.
    const due = weekly ? done || countInWeek(day) < target : isDayScheduled(schedule, day);
    return { day, due, done, today: day === today };
  });

  const todayCell = grid[grid.length - 1];
  const dueToday = todayCell.due;
  const doneToday = todayCell.done;

  // Most recent due day before today: was it missed?
  let missedLastDue = false;
  if (!weekly) {
    for (let i = grid.length - 2; i >= 0; i--) {
      if (grid[i].due) {
        missedLastDue = !grid[i].done;
        break;
      }
    }
  }

  let doneInWindow: number;
  let dueInWindow: number;
  if (weekly) {
    doneInWindow = grid.filter((c) => c.done).length;
    dueInWindow = target * 2;
  } else {
    dueInWindow = grid.filter((c) => c.due).length;
    doneInWindow = grid.filter((c) => c.due && c.done).length;
  }
  const rate = dueInWindow ? Math.min(1, doneInWindow / dueInWindow) : null;

  return { dueToday, doneToday, missedLastDue, grid, rate, doneInWindow, dueInWindow };
}

/** Completion of one habit over [from, to]: done ÷ due, null when nothing was due. */
export function habitPeriodStats(
  schedule: HabitSchedule,
  doneDays: Set<DayKey>,
  from: DayKey,
  to: DayKey,
): { done: number; due: number; rate: number | null } {
  const days: DayKey[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const doneInRange = days.filter((d) => doneDays.has(d)).length;
  let due: number;
  let done: number;
  if ("perWeek" in schedule) {
    due = Math.max(1, Math.round((days.length / 7) * Math.max(1, schedule.perWeek)));
    done = Math.min(doneInRange, due);
  } else {
    const scheduled = days.filter((d) => isDayScheduled(schedule, d));
    due = scheduled.length;
    done = scheduled.filter((d) => doneDays.has(d)).length;
  }
  return { done, due, rate: due ? done / due : null };
}
