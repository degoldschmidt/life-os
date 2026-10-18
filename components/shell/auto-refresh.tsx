"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps this device current with changes made on another one: refresh server data when the
 * app regains focus and every 30 s while visible. Cheap for one user, no websocket needed.
 */
export function AutoRefresh({ everyMs = 30_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = setInterval(refresh, everyMs);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router, everyMs]);
  return null;
}
