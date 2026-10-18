/** Planned-hours meter. Turns orange when value exceeds max. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  const over = value > max;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className="relative h-[6px] w-full rounded-[3px]"
      style={{ background: "var(--tile-2)" }}
    >
      <span
        className="absolute left-0 top-0 h-full rounded-[3px]"
        style={{ width: `${pct}%`, background: over ? "var(--orange)" : "var(--text)" }}
      />
    </div>
  );
}
