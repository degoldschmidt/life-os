export type DotState = "open" | "done" | "attention";

export function Dot({ state = "open", size = 8 }: { state?: DotState; size?: number }) {
  const base = { width: size, height: size, borderRadius: "50%", display: "inline-block", flex: "none" } as const;
  if (state === "attention") return <i aria-hidden="true" style={{ ...base, background: "var(--orange)" }} />;
  if (state === "done") return <i aria-hidden="true" style={{ ...base, background: "var(--text)" }} />;
  return <i aria-hidden="true" style={{ ...base, border: "1.2px solid var(--text)" }} />;
}

export function OrangeDot({ size = 7 }: { size?: number }) {
  return <Dot state="attention" size={size} />;
}
