/** Numbered index list, the Braun "01 Capture / 02 Distill" pattern. */
export function IndexList({
  items,
  activeIndex,
}: {
  items: { label: string; href?: string; done?: boolean }[];
  activeIndex?: number;
}) {
  return (
    <ol className="mono grid grid-cols-[28px_1fr] gap-y-[9px] text-[12px]">
      {items.map((it, i) => {
        const active = i === activeIndex;
        return (
          <li key={it.label} className="contents">
            <span className={active ? "text-orange" : "text-muted"}>{String(i + 1).padStart(2, "0")}</span>
            <span className={active ? "text-orange" : it.done ? "text-muted line-through" : undefined}>
              {it.href ? <a href={it.href}>{it.label}</a> : it.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
