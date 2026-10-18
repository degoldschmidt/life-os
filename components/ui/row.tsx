import type { ReactNode } from "react";

/** A list row with dotted leader: index, checkbox, title, trailing code and time. */
export function Row({
  index,
  leading,
  children,
  code,
  trailing,
  done,
}: {
  index?: number;
  leading?: ReactNode;
  children: ReactNode;
  code?: string;
  trailing?: ReactNode;
  done?: boolean;
}) {
  return (
    <div className="leader flex items-center gap-3 py-[11px] text-[14px] last:border-b-0">
      {index !== undefined ? (
        <span className="mono w-5 text-muted">{String(index).padStart(2, "0")}</span>
      ) : null}
      {leading}
      <span className={`min-w-0 flex-1 truncate ${done ? "text-muted line-through" : ""}`}>{children}</span>
      {code ? <span className="label text-muted">{code}</span> : null}
      {trailing ? <span className="mono w-10 text-right text-muted">{trailing}</span> : null}
    </div>
  );
}

export function Checkbox({ checked, label }: { checked?: boolean; label: string }) {
  return (
    <span
      role="checkbox"
      aria-checked={!!checked}
      aria-label={label}
      className="inline-flex h-[14px] w-[14px] flex-none items-center justify-center rounded-[3px]"
      style={{ border: "1.2px solid var(--text)", background: checked ? "var(--text)" : "transparent" }}
    >
      {checked ? (
        <i aria-hidden="true" className="block h-[4px] w-[7px] -translate-y-px -rotate-45" style={{ borderLeft: "1.3px solid var(--tile)", borderBottom: "1.3px solid var(--tile)" }} />
      ) : null}
    </span>
  );
}
