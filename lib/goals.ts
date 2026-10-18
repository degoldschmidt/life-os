import type { KeyResult } from "@/lib/db/schema";

export const MAX_KEY_RESULTS = 3;

/** 0..1. A target of zero counts as met only when the current value is also zero or below. */
export function krProgress(kr: Pick<KeyResult, "current" | "target">): number {
  if (!Number.isFinite(kr.target) || !Number.isFinite(kr.current)) return 0;
  if (kr.target === 0) return kr.current <= 0 ? 1 : 0;
  return Math.max(0, Math.min(1, kr.current / kr.target));
}

/** Mean progress across key results, or null when the goal has none. */
export function goalProgress(krs: Pick<KeyResult, "current" | "target">[]): number | null {
  if (krs.length === 0) return null;
  return krs.reduce((a, k) => a + krProgress(k), 0) / krs.length;
}

/** How many dots of a 21-dot grid to fill for a progress value. */
export function dotsFor(progress: number | null, total = 21): number {
  return progress == null ? 0 : Math.round(progress * total);
}

/**
 * Parse the key-result lines of the goal form: one per line, "metric | target | unit".
 * Lines without a numeric target are ignored. At most MAX_KEY_RESULTS are kept.
 */
export function parseKeyResults(text: string): KeyResult[] {
  const out: KeyResult[] = [];
  for (const line of text.split("\n")) {
    const [metric, target, unit] = line.split("|").map((s) => s.trim());
    const n = Number(target?.replace(",", "."));
    if (!metric || !target || !Number.isFinite(n)) continue;
    out.push({ id: `kr${out.length + 1}`, metric, target: n, current: 0, unit: unit || undefined });
    if (out.length === MAX_KEY_RESULTS) break;
  }
  return out;
}

export type Staleness = "fresh" | "idle" | "stale";

/** Warn when a goal or project hasn't been touched: idle after 7 days, stale after 14. */
export function staleness(lastTouchedDaysAgo: number | null): Staleness {
  if (lastTouchedDaysAgo == null) return "stale";
  if (lastTouchedDaysAgo >= 14) return "stale";
  if (lastTouchedDaysAgo >= 7) return "idle";
  return "fresh";
}
