"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Mono } from "@/components/ui/label";
import type { SetupResult } from "@/app/actions/setup";

/** A server-action form that stays on the page and shows its result, so you can work down the Setup page. */
export function SetupForm({ action, children, submit }: { action: (fd: FormData) => Promise<SetupResult>; children: React.ReactNode; submit: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await action(fd);
          setMsg({ ok: r.ok, text: r.ok ? r.message : r.error });
        });
      }}
    >
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" variant="fill" disabled={pending}>{pending ? "Saving…" : submit}</Button>
        {msg ? <Mono className={msg.ok ? "text-muted" : "text-orange"}>{msg.text.toUpperCase()}</Mono> : null}
      </div>
    </form>
  );
}
