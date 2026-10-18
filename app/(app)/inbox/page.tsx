import type { Metadata } from "next";
import { Tile } from "@/components/ui/tile";
import { Label, Rule } from "@/components/ui/label";
import { ThinNumber } from "@/components/ui/thin-number";
import { TaskRow } from "@/components/tasks/task-row";
import { CaptureButtonInline } from "@/components/capture/capture-inline";
import { requireUser } from "@/lib/auth";
import { listInbox } from "@/lib/services/tasks";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  const user = await requireUser();
  const items = await listInbox(user.id);

  return (
    <div className="grid gap-[14px] md:grid-cols-[240px_minmax(0,1fr)]">
      <Tile dark className="flex flex-col">
        <Label>Inbox</Label>
        <ThinNumber size={112} className="mt-5">{items.length}</ThinNumber>
        <Rule dotted className="my-5" />
        <p className="text-[14px] text-muted">
          Capture fast, decide later. Each item goes to Today, Tomorrow, Someday, or is dropped.
        </p>
      </Tile>
      <Tile>
        <div className="flex justify-between">
          <Label>Triage</Label>
          <Label>{items.length}</Label>
        </div>
        <Rule dotted />
        {items.length === 0 ? (
          <div className="py-6">
            <p className="text-[18px]">Inbox is empty.</p>
            <p className="mt-1 text-[14px] text-muted">Anything you capture without a date lands here.</p>
          </div>
        ) : (
          items.map((t, i) => <TaskRow key={t.id} task={t} mode="inbox" index={i + 1} />)
        )}
        <div className="mt-4">
          <CaptureButtonInline />
        </div>
      </Tile>
    </div>
  );
}
