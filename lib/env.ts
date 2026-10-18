/** Public Supabase config. Read lazily so `next build` works without env vars. */
export function supabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  return { url, key };
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

/** The single email allowed to use this instance. Comparison is case-insensitive. */
export function isAllowedEmail(email: string | null | undefined) {
  const allowed = process.env.AUTH_ALLOWED_EMAIL;
  if (!allowed || !email) return false;
  return email.trim().toLowerCase() === allowed.trim().toLowerCase();
}
