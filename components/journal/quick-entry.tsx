"use client";

import { useState, useTransition } from "react";
import { addInterstitial } from "@/app/actions/journal";

/** One line, right now. Enter saves it with the current time. */
export function QuickEntry() {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const value = text;
        if (!value.trim()) return;
        start(async () => {
          await addInterstitial(value);
          setText("");
        });
      }}
      className="flex gap-2"
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        placeholder="What's on your mind right now?"
        aria-label="Quick journal entry"
        enterKeyHint="send"
        className="min-w-0 flex-1 rounded-[8px] border border-line bg-transparent px-3 py-[10px] text-[15px]"
      />
      <button
        type="submit"
        disabled={pending || !text.trim()}
        className="rounded-full border-[1.2px] border-text px-[18px] py-[9px] font-mono text-[12px] uppercase tracking-[0.04em] disabled:opacity-40"
      >
        Add
      </button>
    </form>
  );
}
