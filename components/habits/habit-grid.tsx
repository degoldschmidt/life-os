import type { GridCell } from "@/lib/habits";

/** 14 days, oldest left. Filled = done, ring = due and open, tiny dot = not due. */
export function HabitGrid({ cells, label }: { cells: GridCell[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="grid w-max gap-[9px]" style={{ gridTemplateColumns: "repeat(14, 7px)" }}>
      {cells.map((c) => {
        const style = c.done
          ? { background: "var(--text)" }
          : c.due
            ? { border: `1px solid ${c.today ? "var(--orange)" : "var(--muted)"}` }
            : { background: "var(--line)", transform: "scale(0.45)" };
        return <i key={c.day} title={c.day} className="block h-[7px] w-[7px] rounded-full" style={style} />;
      })}
    </div>
  );
}
