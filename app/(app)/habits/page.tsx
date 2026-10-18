import type { Metadata } from "next";
import { Placeholder } from "@/components/shell/placeholder";

export const metadata: Metadata = { title: "Habits" };

export default function Page() {
  return <Placeholder title="Habits" phase={2} description="Up to five habits, daily toggles, a 14-day dot grid and a completion rate. Never miss twice." />;
}
