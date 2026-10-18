/** Progress or habit history as a grid of dots. filled = done, attention = the orange one. */
export function DotGrid({
  total,
  filled,
  attention,
  cols = 7,
  label,
}: {
  total: number;
  filled: number;
  attention?: number;
  cols?: number;
  label?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label ?? `${filled} of ${total}`}
      className="grid w-max gap-[9px]"
      style={{ gridTemplateColumns: `repeat(${cols}, 7px)` }}
    >
      {Array.from({ length: total }, (_, i) => {
        const isAttention = attention === i;
        const isFilled = i < filled;
        return (
          <i
            key={i}
            className="block h-[7px] w-[7px] rounded-full"
            style={
              isAttention
                ? { background: "var(--orange)" }
                : isFilled
                  ? { background: "var(--text)" }
                  : { border: "1px solid var(--muted)" }
            }
          />
        );
      })}
    </div>
  );
}
