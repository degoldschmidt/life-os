import type { Metadata } from "next";
import { Tile } from "@/components/ui/tile";
import { Label, Rule } from "@/components/ui/label";
import { ThinNumber } from "@/components/ui/thin-number";
import { Stepper } from "@/components/ui/stepper";
import { OrangeDot } from "@/components/ui/dot";
import { Placeholder } from "@/components/shell/placeholder";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return (
    <div className="grid gap-[14px] md:grid-cols-[260px_minmax(0,1fr)]">
      <Tile dark className="flex flex-col">
        <div className="flex justify-between">
          <Label>Weekly review</Label>
          <OrangeDot />
        </div>
        <Rule dotted className="mt-4" />
        <ThinNumber size={64} className="mt-3 text-[#7a7a7a]">01</ThinNumber>
        <Label className="mt-2 text-on-ink">Clear</Label>
        <Stepper steps={["Clear", "Look back", "Goals", "Reflect", "Look ahead", "Close"]} current={0} />
        <div className="mt-6">
          <ButtonLink href="/shutdown" className="!border-on-ink !text-on-ink">Daily shutdown</ButtonLink>
        </div>
      </Tile>
      <Placeholder
        title="Review"
        phase={3}
        description="Daily shutdown, weekly review, monthly, quarterly and annual flows as resumable steppers. The only place with charts."
      />
    </div>
  );
}
