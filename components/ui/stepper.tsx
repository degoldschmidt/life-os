import { Dot } from "./dot";

/** Ritual step rail. Lives inside a dark Tile. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mt-4">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "attention" : "open";
        return (
          <li
            key={s}
            aria-current={i === current ? "step" : undefined}
            className={`mono grid grid-cols-[28px_1fr_16px] items-center py-2 text-[12px] ${i === current ? "text-orange" : i < current ? "text-text" : "text-muted"}`}
          >
            <span className={i === current ? "text-orange" : "text-muted"}>{String(i + 1).padStart(2, "0")}</span>
            <span>{s}</span>
            <span className="justify-self-end"><Dot state={state} /></span>
          </li>
        );
      })}
    </ol>
  );
}
