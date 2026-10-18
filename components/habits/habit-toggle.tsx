"use client";

import { useTransition } from "react";
import { toggleHabit } from "@/app/actions/habits";

/** One-tap log for today. Filled = done, outline = open, orange outline = missed yesterday (don't miss twice). */
export function HabitToggle({
  habitId,
  name,
  done,
  nudge = false,
  size = 26,
}: {
  habitId: string;
  name: string;
  done: boolean;
  nudge?: boolean;
  size?: number;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={done}
      aria-label={`${name}: ${done ? "done today" : "not done today"}`}
      disabled={pending}
      onClick={() => start(() => toggleHabit(habitId, !done))}
      className="-m-2 p-2 disabled:opacity-50"
    >
      <span
        className="block rounded-full"
        style={{
          width: size,
          height: size,
          background: done ? "var(--text)" : "transparent",
          border: `1.5px solid ${done ? "var(--text)" : nudge ? "var(--orange)" : "var(--text)"}`,
        }}
      />
    </button>
  );
}
