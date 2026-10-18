"use client";

import { useState, useTransition } from "react";
import { Label, Mono } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { analyzeBrainDump } from "@/app/actions/ai";
import { applyBrainDump } from "@/app/actions/setup";
import type { Dump } from "@/lib/ai/prompts";

type Row<T> = T & { on: boolean };
type State = { tasks: Row<Dump["tasks"][number]>[]; projects: Row<Dump["projects"][number]>[]; goals: Row<Dump["goals"][number]>[]; habits: Row<Dump["habits"][number]>[] };

const sel = "rounded-[6px] border border-line bg-transparent px-2 py-1 text-[12px]";

function AreaSelect({ value, codes, onChange, allowNone }: { value: string | null; codes: string[]; onChange: (v: string | null) => void; allowNone: boolean }) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} aria-label="Area" className={sel}>
      {allowNone ? <option value="">—</option> : null}
      {codes.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

/** Paste anything, review the sorted result, add what you want. Works with or without Claude. */
export function DumpImport({ areaCodes }: { areaCodes: string[] }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<State | null>(null);
  const [mode, setMode] = useState<"claude" | "lines" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const analyze = () =>
    start(async () => {
      setError(null); setDone(null);
      const r = await analyzeBrainDump(text);
      if (!r.ok) { setError(r.error); return; }
      const on = <T,>(a: T[]) => a.map((x) => ({ ...x, on: true }));
      setItems({ tasks: on(r.data.tasks), projects: on(r.data.projects), goals: on(r.data.goals), habits: on(r.data.habits) });
      setMode(r.mode ?? null);
    });

  const patch = <K extends keyof State>(kind: K, i: number, p: Partial<State[K][number]>) =>
    setItems((s) => (s ? { ...s, [kind]: s[kind].map((x, j) => (j === i ? { ...x, ...p } : x)) } : s));

  const chosen = items ? items.tasks.filter((x) => x.on).length + items.projects.filter((x) => x.on).length + items.goals.filter((x) => x.on).length + items.habits.filter((x) => x.on).length : 0;

  function add() {
    if (!items) return;
    start(async () => {
      const strip = <T extends { on: boolean }>(rows: T[]) => rows.filter((r) => r.on).map(({ on, ...rest }) => { void on; return rest; });
      const r = await applyBrainDump({ tasks: strip(items.tasks), projects: strip(items.projects), goals: strip(items.goals), habits: strip(items.habits) });
      if (r.ok) { setDone(r.message); setItems(null); setText(""); } else setError(r.error);
    });
  }

  const check = (on: boolean, set: (v: boolean) => void, label: string) => (
    <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} aria-label={label} className="h-4 w-4 flex-none accent-[var(--text)]" />
  );

  return (
    <div>
      <textarea
        rows={7}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={20000}
        aria-label="Brain dump"
        placeholder={"Everything on your mind, in any shape:\n- finish connectivity paper, figures first, due 30 nov\n- run a sub-50 10 km this quarter\n- call Mum on Sundays\n- renew passport #FIN\n- stretch every morning"}
        className="w-full rounded-[8px] border border-line bg-transparent px-3 py-3 text-[15px] leading-[1.55]"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="fill" disabled={pending || !text.trim()} onClick={analyze}>{pending && !items ? "Sorting…" : "Sort it out"}</Button>
        <Mono className="text-muted">NOTHING IS SAVED UNTIL YOU APPROVE</Mono>
      </div>
      {error ? <p className="mt-3 text-[13px] text-orange">{error}</p> : null}
      {done ? <p className="mt-3 text-[14px]">{done}</p> : null}

      {items ? (
        <div className="mt-5">
          <p className="text-[13px] text-muted">
            {mode === "claude" ? "Claude sorted your notes. Untick anything you don't want." : "One task per line. Add an Anthropic key in Settings for smarter sorting into goals, projects and habits."}
          </p>

          {items.goals.length ? <Label className="mt-4 block">Goals</Label> : null}
          {items.goals.map((g, i) => (
            <div key={`g${i}`} className="leader flex items-start gap-3 py-2 text-[14px]">
              {check(g.on, (v) => patch("goals", i, { on: v }), `Add goal ${g.title}`)}
              <div className="min-w-0 flex-1">
                <div>{g.title} <Mono className="text-muted">{g.horizon.toUpperCase()}</Mono></div>
                {g.keyResults.length ? <div className="mono mt-1 text-muted">{g.keyResults.join(" · ")}</div> : null}
              </div>
              <AreaSelect value={g.area ?? areaCodes[0]} codes={areaCodes} allowNone={false} onChange={(v) => patch("goals", i, { area: v })} />
            </div>
          ))}

          {items.projects.length ? <Label className="mt-4 block">Projects</Label> : null}
          {items.projects.map((p, i) => (
            <div key={`p${i}`} className="leader flex items-center gap-3 py-2 text-[14px]">
              {check(p.on, (v) => patch("projects", i, { on: v }), `Add project ${p.title}`)}
              <span className="min-w-0 flex-1">{p.title}</span>
              <AreaSelect value={p.area ?? areaCodes[0]} codes={areaCodes} allowNone={false} onChange={(v) => patch("projects", i, { area: v })} />
            </div>
          ))}

          {items.habits.length ? <Label className="mt-4 block">Habits</Label> : null}
          {items.habits.map((h, i) => (
            <div key={`h${i}`} className="leader flex items-center gap-3 py-2 text-[14px]">
              {check(h.on, (v) => patch("habits", i, { on: v }), `Add habit ${h.name}`)}
              <span className="min-w-0 flex-1">{h.name} <Mono className="text-muted">{h.rhythm.toUpperCase()}</Mono></span>
              <AreaSelect value={h.area} codes={areaCodes} allowNone onChange={(v) => patch("habits", i, { area: v })} />
            </div>
          ))}

          {items.tasks.length ? <Label className="mt-4 block">Tasks · go to your Inbox</Label> : null}
          {items.tasks.map((t, i) => (
            <div key={`t${i}`} className="leader flex items-center gap-3 py-2 text-[14px]">
              {check(t.on, (v) => patch("tasks", i, { on: v }), `Add task ${t.title}`)}
              <span className="min-w-0 flex-1">
                {t.title}
                {t.project ? <Mono className="text-muted"> · {t.project}</Mono> : null}
                {t.due ? <Mono className="text-orange"> · DUE {t.due.slice(5)}</Mono> : null}
                {t.estimateMin ? <Mono className="text-muted"> · {t.estimateMin}M</Mono> : null}
              </span>
              <AreaSelect value={t.area} codes={areaCodes} allowNone onChange={(v) => patch("tasks", i, { area: v })} />
            </div>
          ))}

          <div className="mt-4 flex items-center gap-3">
            <Button variant="fill" disabled={pending || chosen === 0} onClick={add}>{pending ? "Adding…" : `Add ${chosen} item${chosen === 1 ? "" : "s"}`}</Button>
            <Button variant="quiet" disabled={pending} onClick={() => setItems(null)}>Start over</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
