import { Tile } from "@/components/ui/tile";
import { Label } from "@/components/ui/label";

export default function OfflinePage() {
  return (
    <main className="mx-auto w-full max-w-[520px] p-6">
      <Tile dark>
        <Label>Offline</Label>
        <p className="mt-4 text-[18px]">No connection. Life OS needs the network to load your data.</p>
        <p className="mt-2 text-[13px] text-muted">Offline writes are planned for a later phase.</p>
      </Tile>
    </main>
  );
}
