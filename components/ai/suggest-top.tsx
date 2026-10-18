"use client";

import { useState, useTransition } from "react";
import { Label, Mono } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { suggestTop3 } from "@/app/actions/ai";

/** "Suggest with Claude": proposes up to three tasks with reasons; nothing changes until you accept. */
export function SuggestTop({
  which,
  titleOf,
  onApply,
}: {
  which: "today" | "tomorrow";
  /** Resolve a task id to a title for display; unknown ids show as "Task". */
  titleOf: (id: string) => string | undefined;
  onApply: (ids: string[]) => Promise<void>;
}) {
  const [picks, setPicks] = useState<{ id: string; reason: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mb-4 rounded-[10px] bg-tile-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>Suggestion</Label>
        <Button
          variant="quiet"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await suggestTop3(which);
              if (r.ok) setPicks(r.data);
              else { setPicks(null); setError(r.error); }
            })
          }
        >
          {pending ? "Thinking…" : picks ? "Suggest again" : "Suggest with Claude"}
        </Button>
      </div>
      {error ? <p className="mt-3 text-[13px] text-orange">{error}</p> : null}
      {picks ? (
        <>
          <ol className="mt-3">
            {picks.map((p, i) => (
              <li key={p.id} className="py-2">
                <div className="flex gap-3 text-[14px]"><Mono className="text-orange">{String(i + 1).padStart(2, "0")}</Mono><span>{titleOf(p.id) ?? "Task"}</span></div>
                <p className="mt-1 pl-8 text-[13px] text-muted">{p.reason}</p>
              </li>
            ))}
          </ol>
          <Button
            variant="fill"
            className="mt-2"
            disabled={pending}
            onClick={() => start(async () => { await onApply(picks.map((p) => p.id)); setPicks(null); })}
          >
            Use these
          </Button>
        </>
      ) : null}
    </div>
  );
}
