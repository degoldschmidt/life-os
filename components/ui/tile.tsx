import type { CSSProperties, HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  /** Instrument-black tile. Child tokens (text, muted, line) re-map automatically. */
  dark?: boolean;
  as?: "div" | "section" | "article";
};

const darkVars = {
  "--text": "var(--on-ink)",
  "--muted": "var(--on-ink-muted)",
  "--line": "var(--line-dark)",
  "--tile-2": "#2a2a2a",
} as CSSProperties;

export function Tile({ dark, as: Tag = "div", className = "", style, children, ...rest }: Props) {
  return (
    <Tag
      className={`rounded-tile p-5 md:p-[22px] ${dark ? "bg-ink text-on-ink ring-1 ring-inset ring-[var(--ring-ink)]" : "bg-tile text-text"} ${className}`}
      style={dark ? { ...darkVars, ...style } : style}
      {...rest}
    >
      {children}
    </Tag>
  );
}
