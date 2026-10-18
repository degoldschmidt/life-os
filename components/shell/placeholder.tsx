import { Tile } from "@/components/ui/tile";
import { Label, Rule } from "@/components/ui/label";
import { IndexList } from "@/components/ui/index-list";

const PHASES = ["Foundation", "Core objects and Today", "Daily loop", "Reviews and trends", "Integrations", "Polish"];

export function Placeholder({ title, phase, description }: { title: string; phase: number; description: string }) {
  return (
    <div className="grid gap-[14px] lg:grid-cols-[minmax(0,1fr)_300px]">
      <Tile className="min-h-[260px]">
        <Label>{String(phase).padStart(2, "0")} — {title}</Label>
        <h1 className="mt-4 text-[26px] font-normal leading-[1.15] tracking-[-0.01em]">{title}</h1>
        <p className="mt-3 max-w-[480px] text-[14px] text-muted">{description}</p>
        <Rule dotted className="mt-6" />
        <p className="label text-muted">Arrives in phase {phase}</p>
      </Tile>
      <Tile dark>
        <Label>Build index</Label>
        <Rule dotted className="mt-3" />
        <IndexList items={PHASES.map((p, i) => ({ label: p, done: i < 1 }))} activeIndex={phase} />
      </Tile>
    </div>
  );
}
