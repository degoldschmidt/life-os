"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const PENDING_COOKIE = "lifeos_login_email";
const emailSchema = z.object({ email: z.email(), next: z.string().startsWith("/").default("/today") });
const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6,10}$/) });

function safeNext(value: FormDataEntryValue | null): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/today";
}

/** Step 1: email the user a sign-in link and a one-time code. */
export async function sendMagicLink(formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get("email"), next: safeNext(formData.get("next")) });
  if (!parsed.success) redirect("/login?error=send-failed");

  const { email, next } = parsed.data;
  const jar = await cookies();

  // Do not reveal whether an address is allow-listed; behave the same and let the code fail later.
  if (!isAllowedEmail(email)) {
    jar.set(PENDING_COOKIE, email, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
    redirect("/login?sent=1");
  }

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
  });
  if (error) {
    console.error("[login] signInWithOtp failed:", error.code ?? error.status, error.message);
    redirect(error.code === "over_email_send_rate_limit" ? "/login?error=rate-limit" : "/login?error=send-failed");
  }

  // Remember the address for ten minutes (httpOnly cookie) so the code step needs only the code.
  jar.set(PENDING_COOKIE, email, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  redirect(`/login?sent=1&next=${encodeURIComponent(next)}`);
}

/** Step 2 (alternative to the link): sign in with the code from the email. Works inside an installed iOS app. */
export async function verifyCode(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const parsed = codeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) redirect(`/login?sent=1&error=code-format&next=${encodeURIComponent(next)}`);

  const jar = await cookies();
  const email = jar.get(PENDING_COOKIE)?.value;
  if (!email || !isAllowedEmail(email)) redirect("/login?error=code-expired");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: parsed.data.code, type: "email" });
  if (error || !data.user) {
    console.error("[login] verifyOtp failed:", error?.code ?? error?.status, error?.message);
    redirect(`/login?sent=1&error=code-invalid&next=${encodeURIComponent(next)}`);
  }
  if (!isAllowedEmail(data.user.email)) {
    await supabase.auth.signOut();
    redirect("/login?error=not-allowed");
  }
  jar.delete(PENDING_COOKIE);
  redirect(next);
}

/** Go back to the email step. */
export async function startOver() {
  (await cookies()).delete(PENDING_COOKIE);
  redirect("/login");
}
