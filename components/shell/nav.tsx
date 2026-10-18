"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/today", label: "Today", key: "1" },
  { href: "/week", label: "Week", key: "2" },
  { href: "/goals", label: "Goals", key: "3" },
  { href: "/habits", label: "Habits", key: "4" },
  { href: "/journal", label: "Journal", key: "5" },
  { href: "/review", label: "Review", key: "6" },
] as const;

const PHONE_TABS = ["/today", "/week", "/goals", "/journal", "/review"];

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="flex flex-col gap-[2px]">
      {NAV.map((n) => {
        const active = pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center justify-between rounded-[7px] px-[10px] py-[7px] text-[14px] ${active ? "bg-tile text-text" : "text-muted hover:text-text"}`}
          >
            <span>{n.label}</span>
            <span className="mono text-muted">{n.key}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function PhoneTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-paper/95 px-2 pt-3 backdrop-blur md:hidden"
      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
    >
      {NAV.filter((n) => PHONE_TABS.includes(n.href)).map((n) => {
        const active = pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`label flex flex-1 flex-col items-center gap-[6px] ${active ? "text-text" : "text-muted"}`}
          >
            <i
              aria-hidden="true"
              className="block h-[6px] w-[6px] rounded-full"
              style={active ? { background: "var(--orange)" } : { border: "1px solid currentColor" }}
            />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
