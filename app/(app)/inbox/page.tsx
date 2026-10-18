import type { Metadata } from "next";
import { Placeholder } from "@/components/shell/placeholder";

export const metadata: Metadata = { title: "Inbox" };

export default function Page() {
  return <Placeholder title="Inbox" phase={1} description="Quick capture lands here. Triage to today, a date, someday or a project." />;
}
