import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { exchangeCode, GoogleError } from "@/lib/gcal/api";
import { getSettings } from "@/lib/services/settings";
import { saveTokens, syncGoogleCalendar } from "@/lib/services/gcal";

export const dynamic = "force-dynamic";

function done(request: NextRequest, status: string) {
  const res = NextResponse.redirect(new URL(`/settings?google=${status}`, request.url));
  res.cookies.delete({ name: "lifeos_g_state", path: "/api/google" });
  res.cookies.delete({ name: "lifeos_g_verifier", path: "/api/google" });
  return res;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const sp = request.nextUrl.searchParams;
  if (sp.get("error")) return done(request, "denied");
  const code = sp.get("code");
  const state = sp.get("state");
  const savedState = request.cookies.get("lifeos_g_state")?.value;
  const verifier = request.cookies.get("lifeos_g_verifier")?.value;
  // The state must come back exactly as we set it, or the request didn't start here.
  if (!code || !state || !savedState || state !== savedState || !verifier) return done(request, "state-mismatch");

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  try {
    const tokens = await exchangeCode(fetch, {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: `${origin}/api/google/callback`,
      code,
      verifier,
    });
    await saveTokens(user.id, tokens);
    const settings = await getSettings();
    await syncGoogleCalendar(user.id, settings.tz).catch((e) => console.error("[google] first sync failed:", e));
    return done(request, "connected");
  } catch (e) {
    console.error("[google] callback failed:", e instanceof GoogleError ? `${e.status} ${e.message}` : e);
    return done(request, "failed");
  }
}
