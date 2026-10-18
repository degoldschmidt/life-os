import Link from "next/link";
import type { ReactNode } from "react";
import { PhoneTabs, SideNav } from "./nav";
import { Label, Mono } from "@/components/ui/label";

const AREAS = [
  { code: "WRK", name: "Work" },
  { code: "HLT", name: "Health" },
  { code: "REL", name: "Relationships" },
  { code: "FIN", name: "Finances" },
];

export function AppShell({ children, email }: { children: ReactNode; email: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 md:grid md:grid-cols-[200px_minmax(0,1fr)]">
      <aside className="hidden border-r border-line px-3 py-5 md:flex md:flex-col">
        <Link href="/today" className="mb-5 flex items-center gap-2 px-[10px] text-[15px] font-medium">
          <i aria-hidden="true" className="block h-[10px] w-[10px] rounded-full border-2 border-text" />
          Life OS
        </Link>
        <SideNav />
        <Label className="mb-2 mt-6 px-[10px]">Areas</Label>
        <ul className="flex flex-col gap-[9px] px-[10px] text-[13.5px] text-muted">
          {AREAS.map((a) => (
            <li key={a.code} className="flex items-center justify-between">
              <span>{a.name}</span>
              <Mono className="label">{a.code}</Mono>
            </li>
          ))}
        </ul>
        <div className="mt-auto px-[10px]">
          <Link href="/inbox" className="flex items-center justify-between text-[13px] text-muted hover:text-text">
            <span>Inbox</span>
            <Mono className="text-muted">C</Mono>
          </Link>
          <div className="mt-3 flex items-center justify-between text-[13px] text-muted">
            <span>Search</span>
            <Mono className="text-muted">⌘K</Mono>
          </div>
          <form action="/auth/signout" method="post" className="mt-6">
            <button type="submit" className="label text-muted hover:text-text" title={email}>
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 px-4 pb-28 pt-5 md:px-6 md:pb-10 md:pt-6">{children}</main>
      <PhoneTabs />
      <Link
        href="/inbox"
        aria-label="Capture"
        className="fixed bottom-[88px] right-[18px] z-20 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-ink text-[26px] font-extralight text-on-ink md:hidden"
      >
        +
      </Link>
    </div>
  );
}
