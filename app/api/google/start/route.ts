import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { newAuthRequest } from "@/lib/gcal/api";
import { isGoogleConfigured } from "@/lib/services/gcal";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!isGoogleConfigured()) return NextResponse.redirect(new URL("/settings?google=not-configured", request.url));

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const { state, verifier, url } = newAuthRequest(process.env.GOOGLE_CLIENT_ID!, `${origin}/api/google/callback`);
  const res = NextResponse.redirect(url);
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/api/google" };
  res.cookies.set("lifeos_g_state", state, opts);
  res.cookies.set("lifeos_g_verifier", verifier, opts);
  return res;
}
