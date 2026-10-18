import type { HTMLAttributes } from "react";

export function Label({ className = "", children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`label text-muted ${className}`} {...rest}>
      {children}
    </span>
  );
}

export function Mono({ className = "", children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`mono ${className}`} {...rest}>
      {children}
    </span>
  );
}

export function Rule({ dotted = false, className = "" }: { dotted?: boolean; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`my-3 ${className}`}
      style={{ borderTop: `1px ${dotted ? "dotted" : "solid"} var(--line)` }}
    />
  );
}
