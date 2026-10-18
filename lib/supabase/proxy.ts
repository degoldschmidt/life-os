import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail, isSupabaseConfigured, supabasePublicEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/auth", "/offline", "/manifest.webmanifest", "/sw.js", "/icons"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) || pathname.startsWith("/_next");
}

/**
 * Refresh the Supabase session cookie on every request and gate the app:
 * unauthenticated -> /login, authenticated but not allow-listed -> signed out.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (process.env.NODE_ENV === "development" && process.env.DEV_PREVIEW_USER === "1") {
    return NextResponse.next({ request });
  }
  if (!isSupabaseConfigured()) {
    // Not configured yet: let /login render its setup notice, block everything else.
    if (isPublic(pathname)) return NextResponse.next({ request });
    return NextResponse.redirect(new URL("/login?error=not-configured", request.url));
  }

  let response = NextResponse.next({ request });
  const { url, key } = supabasePublicEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims verifies the JWT locally (JWKS) and refreshes when needed.
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined) ?? null;
  const authed = Boolean(data?.claims);

  if (authed && !isAllowedEmail(email)) {
    await supabase.auth.signOut();
    const to = new URL("/login?error=not-allowed", request.url);
    const redirect = NextResponse.redirect(to);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  if (!authed && !isPublic(pathname)) {
    const to = new URL("/login", request.url);
    if (pathname !== "/") to.searchParams.set("next", pathname);
    return NextResponse.redirect(to);
  }

  if (authed && pathname === "/login") {
    return NextResponse.redirect(new URL("/today", request.url));
  }

  return response;
}
