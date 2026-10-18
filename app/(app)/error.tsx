"use client";

import { useEffect } from "react";
import { Tile } from "@/components/ui/tile";
import { Label, Mono } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-[520px] pt-10">
      <Tile dark>
        <Label>Something went wrong</Label>
        <p className="mt-4 text-[18px] leading-[1.35]">This screen couldn&apos;t load. Your data is safe.</p>
        <p className="mt-2 text-[14px] text-muted">It is usually a brief database or network hiccup. Try again; if it keeps happening, check Supabase isn&apos;t paused.</p>
        {error.digest ? <Mono className="mt-3 block text-muted">REF {error.digest}</Mono> : null}
        <div className="mt-5"><Button variant="fill" onClick={reset} className="!border-on-ink !bg-on-ink !text-ink">Try again</Button></div>
      </Tile>
    </div>
  );
}
