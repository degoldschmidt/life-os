import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Magic-link landing: exchange the code for a session, enforce the allowlist, continue. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/today";
  const next = nextParam.startsWith("/") ? nextParam : "/today";

  if (!code) return NextResponse.redirect(`${origin}/login?error=link-invalid`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=link-invalid`);

  if (!isAllowedEmail(data.user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not-allowed`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
