"use client";

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";
const KEY = "lifeos-theme";
const EVENT = "lifeos-theme";

// The <html data-theme> attribute is the source of truth: the pre-paint script in the layout
// sets it from localStorage, and this toggle changes it.
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};
const read = (): Theme => {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" || t === "dark" ? t : "system";
};

/** Light, dark, or follow the device. Stored in this browser only. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);

  function choose(next: Theme) {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch { /* private mode: applies for this visit only */ }
    if (next === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", next);
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="flex gap-2">
      {(["system", "light", "dark"] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          onClick={() => choose(t)}
          className={`label rounded-full border px-4 py-2 ${theme === t ? "border-text bg-text text-paper" : "border-line text-muted hover:text-text"}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
