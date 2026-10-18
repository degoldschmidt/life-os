"use client";

import { useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/row";
import {
  dropTask,
  planToday,
  planTomorrow,
  setTop,
  somedayTask,
  toggleDone,
} from "@/app/actions/tasks";
import { formatHoursMinutes } from "@/lib/dates";

export type TaskView = {
  id: string;
  title: string;
  areaCode: string | null;
  estimateMin: number | null;
  status: "todo" | "done" | "dropped";
  planRank: number | null;
  deadline?: string | null;
};

type Mode = "today" | "inbox" | "stale";

const btn =
  "label rounded-full border border-line px-[10px] py-[6px] text-muted hover:border-text hover:text-text active:opacity-70";

export function TaskRow({ task, mode, index }: { task: TaskView; mode: Mode; index?: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const done = task.status === "done";
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); setOpen(false); });

  return (
    <div className={`leader py-[9px] last:border-b-0 ${pending ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3 text-[14px]">
        {index !== undefined ? <span className="mono w-5 text-muted">{String(index).padStart(2, "0")}</span> : null}
        <button
          type="button"
          aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
          onClick={() => run(() => toggleDone(task.id, !done))}
          className="-m-2 p-2"
        >
          <Checkbox checked={done} label={task.title} />
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`min-w-0 flex-1 truncate text-left ${done ? "text-muted line-through" : ""}`}
        >
          {task.title}
        </button>
        {task.deadline && !done ? <span className="label text-orange">Due {task.deadline.slice(5)}</span> : null}
        {task.areaCode ? <span className="label text-muted">{task.areaCode}</span> : null}
        <span className="mono w-10 text-right text-muted">
          {task.estimateMin ? formatHoursMinutes(task.estimateMin) : ""}
        </span>
      </div>
      {open ? (
        <div className="mt-2 flex flex-wrap gap-2 pl-8">
          {mode !== "today" ? <button className={btn} onClick={() => run(() => planToday(task.id))}>Today</button> : null}
          {mode === "today" && !done
            ? [1, 2, 3].map((r) => (
                <button
                  key={r}
                  className={`${btn} ${task.planRank === r ? "!border-orange !text-orange" : ""}`}
                  onClick={() => run(() => setTop(task.id, task.planRank === r ? null : r))}
                >
                  Top {r}
                </button>
              ))
            : null}
          <button className={btn} onClick={() => run(() => planTomorrow(task.id))}>Tomorrow</button>
          <button className={btn} onClick={() => run(() => somedayTask(task.id))}>Someday</button>
          <button className={btn} onClick={() => run(() => dropTask(task.id))}>Drop</button>
        </div>
      ) : null}
    </div>
  );
}
