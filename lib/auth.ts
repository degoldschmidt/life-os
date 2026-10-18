import { cache } from "react";
import { isAllowedEmail, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string };

/**
 * Development-only preview user, for working on screens before Supabase is set up.
 * Enabled by DEV_PREVIEW_USER=1 and only ever in `next dev`; production builds ignore it.
 */
function devPreviewUser(): CurrentUser | null {
  if (process.env.NODE_ENV !== "development" || process.env.DEV_PREVIEW_USER !== "1") return null;
  return { id: process.env.DEV_PREVIEW_USER_ID ?? "00000000-0000-4000-8000-000000000000", email: "preview@localhost" };
}

/** The signed-in, allow-listed user, or null. Memoised per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const preview = devPreviewUser();
  if (preview) return preview;
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const email = typeof claims.email === "string" ? claims.email : null;
  if (!isAllowedEmail(email)) return null;
  return { id: claims.sub, email: email as string };
});

/** For server actions and route handlers: the current user or a thrown error. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return user;
}
