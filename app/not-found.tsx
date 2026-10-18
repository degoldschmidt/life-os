import Link from "next/link";
import { Tile } from "@/components/ui/tile";
import { Label } from "@/components/ui/label";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[520px] p-6 pt-16">
      <Tile dark>
        <Label>404</Label>
        <p className="mt-4 text-[18px]">That page doesn&apos;t exist.</p>
        <Link href="/today" className="label mt-5 inline-block text-on-ink underline">Back to Today</Link>
      </Tile>
    </main>
  );
}
