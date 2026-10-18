"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicEnv } from "@/lib/env";

export function createClient() {
  const { url, key } = supabasePublicEnv();
  return createBrowserClient(url, key);
}
