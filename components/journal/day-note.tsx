"use client";

import { useState, useTransition } from "react";
import { saveNote } from "@/app/actions/journal";
import { Label } from "@/components/ui/label";

type Scale = number | null;

function Scale5({ name, value, onChange }: { name: string; value: Scale; onChange: (v: Scale) => void }) {
  return (
    <div>
      <Label>{name}</Label>
      <div className="mt-2 flex gap-2" role="radiogroup" aria-label={name}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(value === n ? null : n)}
            className={`mono flex-1 rounded-[8px] border py-[9px] ${value === n ? "border-text bg-text text-paper" : "border-line text-muted"}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The day's note. Saves when you leave the field or tap Save, so nothing is lost on a phone. */
export function DayNote({
  day,
  initialText,
  initialMood,
  initialEnergy,
}: {
  day: string;
  initialText: string;
  initialMood: Scale;
  initialEnergy: Scale;
}) {
  const [text, setText] = useState(initialText);
  const [mood, setMood] = useState<Scale>(initialMood);
  const [energy, setEnergy] = useState<Scale>(initialEnergy);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();

  function save(next: { text?: string; mood?: Scale; energy?: Scale } = {}) {
    const payload = { text: next.text ?? text, mood: next.mood === undefined ? mood : next.mood, energy: next.energy === undefined ? energy : next.energy };
    start(async () => {
      try {
        await saveNote(day, payload.text, payload.mood, payload.energy);
        setDirty(false);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <textarea
        rows={8}
        value={text}
        maxLength={20000}
        placeholder="Write freely. Nothing here is graded."
        aria-label="Day note"
        onChange={(e) => { setText(e.target.value); setDirty(true); setStatus("idle"); }}
        onBlur={() => { if (dirty) save(); }}
        className="rounded-[8px] border border-line bg-transparent px-3 py-3 font-[family-name:var(--font-sans)] text-[16px] leading-[1.6]"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Scale5 name="Mood" value={mood} onChange={(v) => { setMood(v); save({ mood: v }); }} />
        <Scale5 name="Energy" value={energy} onChange={(v) => { setEnergy(v); save({ energy: v }); }} />
      </div>
      <div className="flex items-center justify-between">
        <span className="label text-muted" role="status">
          {pending ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? <span className="text-orange">Couldn&apos;t save</span> : dirty ? "Unsaved" : ""}
        </span>
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() => save()}
          className="rounded-full border-[1.2px] border-text px-[18px] py-[9px] font-mono text-[12px] uppercase tracking-[0.04em] disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}
