import type { Metadata } from "next";
import { Placeholder } from "@/components/shell/placeholder";

export const metadata: Metadata = { title: "Goals & areas" };

export default function Page() {
  return <Placeholder title="Goals & areas" phase={3} description="One tile per area with its standard, the quarter's goal, a progress dot grid and the next action." />;
}
