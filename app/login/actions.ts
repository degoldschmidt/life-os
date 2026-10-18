"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.email(), next: z.string().startsWith("/").default("/today") });

export async function sendMagicLink(formData: FormData) {
  const parsed = schema.safeParse({ email: formData.get("email"), next: formData.get("next") ?? "/today" });
  if (!parsed.success) redirect("/login?error=send-failed");

  const { email, next } = parsed.data;
  // Do not reveal whether an address is allow-listed; pretend to send.
  if (!isAllowedEmail(email)) redirect("/login?sent=1");

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
  });
  if (error) redirect("/login?error=send-failed");
  redirect("/login?sent=1");
}
