import type { Metadata } from "next";
import { Placeholder } from "@/components/shell/placeholder";

export const metadata: Metadata = { title: "Journal" };

export default function Page() {
  return <Placeholder title="Journal" phase={2} description="Daily note, interstitial entries, mood and energy. Prompts stay collapsed until you want them." />;
}
