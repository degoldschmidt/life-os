"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { Command } from "cmdk";
import { captureTask } from "@/app/actions/tasks";

type Ctx = { openCapture: () => void; openPalette: () => void };
const C = createContext<Ctx>({ openCapture() {}, openPalette() {} });
export const useCapture = () => useContext(C);

const SCREENS = [
  { label: "Today", href: "/today", key: "1" },
  { label: "Week", href: "/week", key: "2" },
  { label: "Goals", href: "/goals", key: "3" },
  { label: "Habits", href: "/habits", key: "4" },
  { label: "Journal", href: "/journal", key: "5" },
  { label: "Review", href: "/review", key: "6" },
  { label: "Inbox", href: "/inbox", key: "I" },
];

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [capture, setCapture] = useState(false);
  const [palette, setPalette] = useState(false);
  const [text, setText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const openCapture = useCallback(() => { setError(null); setCapture(true); }, []);
  const openPalette = useCallback(() => setPalette(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "c") { e.preventDefault(); openCapture(); return; }
      const hit = SCREENS.find((s) => s.key.toLowerCase() === e.key.toLowerCase());
      if (hit) router.push(hit.href);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, openCapture]);

  useEffect(() => { if (capture) setTimeout(() => input.current?.focus(), 30); }, [capture]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  function submit(forceToday: boolean) {
    const value = text;
    start(async () => {
      const r = await captureTask(value, { forceToday });
      if (!r.ok) { setError(r.error); return; }
      setText("");
      setCapture(false);
      setToast(`Added “${r.title}” to ${r.where}`);
    });
  }

  return (
    <C.Provider value={{ openCapture, openPalette }}>
      {children}

      {capture ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-3 md:items-start md:pt-[18vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) setCapture(false); }}>
          <form
            role="dialog"
            aria-label="Quick capture"
            onSubmit={(e) => { e.preventDefault(); submit(false); }}
            onKeyDown={(e) => { if (e.key === "Escape") setCapture(false); }}
            className="w-full max-w-[560px] rounded-tile bg-ink p-5 text-on-ink"
            style={{ ["--muted" as string]: "var(--on-ink-muted)" }}
          >
            <div className="flex items-center justify-between">
              <span className="label text-muted">Capture</span>
              <span className="label text-muted">↵ Inbox · ⌘↵ Today · esc</span>
            </div>
            <input
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(true); } }}
              placeholder="call mum tomorrow #REL ~20m"
              enterKeyHint="send"
              autoComplete="off"
              className="mt-4 w-full border-0 border-b border-line-dark bg-transparent pb-3 text-[20px] text-on-ink outline-none placeholder:text-on-ink-muted"
            />
            <p className="mono mt-3 text-muted">#WRK #HLT #REL #FIN · ~45m · ~1h30 · tomorrow · friday · 20 dec · due 30 nov</p>
            {error ? <p className="mt-2 text-[13px] text-orange">{error}</p> : null}
            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={pending} className="rounded-full bg-on-ink px-[18px] py-[9px] font-mono text-[12px] uppercase tracking-[0.04em] text-ink disabled:opacity-50">Add to Inbox</button>
              <button type="button" disabled={pending} onClick={() => submit(true)} className="rounded-full border border-on-ink px-[18px] py-[9px] font-mono text-[12px] uppercase tracking-[0.04em] text-on-ink disabled:opacity-50">Add to Today</button>
            </div>
          </form>
        </div>
      ) : null}

      <Command.Dialog open={palette} onOpenChange={setPalette} label="Command palette" className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-3 pt-[16vh]">
        <div className="w-full max-w-[520px] overflow-hidden rounded-tile bg-ink text-on-ink">
          <Command.Input placeholder="Go to, or capture…" className="w-full border-0 border-b border-line-dark bg-transparent px-5 py-4 text-[16px] text-on-ink outline-none placeholder:text-on-ink-muted" />
          <Command.List className="max-h-[320px] overflow-auto p-2">
            <Command.Empty className="label p-4 text-on-ink-muted">Nothing found</Command.Empty>
            <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-on-ink-muted">
              {SCREENS.map((s) => (
                <Command.Item key={s.href} value={`go ${s.label}`} onSelect={() => { setPalette(false); router.push(s.href); }} className="flex cursor-pointer items-center justify-between rounded-[8px] px-3 py-[10px] text-[14px] data-[selected=true]:bg-ink-2">
                  <span>{s.label}</span>
                  <span className="mono text-on-ink-muted">{s.key}</span>
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-on-ink-muted">
              <Command.Item value="capture new task" onSelect={() => { setPalette(false); openCapture(); }} className="flex cursor-pointer items-center justify-between rounded-[8px] px-3 py-[10px] text-[14px] data-[selected=true]:bg-ink-2">
                <span>New task</span><span className="mono text-on-ink-muted">C</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </div>
      </Command.Dialog>

      {toast ? (
        <div role="status" className="mono fixed bottom-[96px] left-1/2 z-50 max-w-[90vw] -translate-x-1/2 truncate rounded-full bg-ink px-4 py-[10px] text-on-ink md:bottom-8">
          {toast}
        </div>
      ) : null}
    </C.Provider>
  );
}
