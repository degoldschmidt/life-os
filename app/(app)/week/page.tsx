import type { Metadata } from "next";
import { Placeholder } from "@/components/shell/placeholder";

export const metadata: Metadata = { title: "Week" };

export default function Page() {
  return <Placeholder title="Week" phase={2} description="Seven-day grid with a backlog pane. Drag tasks into the day; the planned-hours meter turns orange past shutdown." />;
}
