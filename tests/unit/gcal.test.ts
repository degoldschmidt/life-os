import { beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt, pkcePair } from "@/lib/gcal/crypto";
import { buildAuthUrl, exchangeCode, fetchEvents, GoogleError, refreshAccessToken, type Fetch } from "@/lib/gcal/api";
import { mapGoogleEvent } from "@/lib/gcal/map";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("crypto", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = encrypt("refresh-token-123");
    const b = encrypt("refresh-token-123");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("refresh-token-123");
  });
  it("rejects tampered ciphertext", () => {
    const buf = Buffer.from(encrypt("secret"), "base64");
    buf[buf.length - 1] ^= 1;
    expect(() => decrypt(buf.toString("base64"))).toThrow();
  });
  it("produces a PKCE challenge that matches its verifier", async () => {
    const { verifier, challenge } = pkcePair();
    const { createHash } = await import("node:crypto");
    expect(createHash("sha256").update(verifier).digest("base64url")).toBe(challenge);
  });
});

describe("auth url", () => {
  it("requests offline read-only access with PKCE", () => {
    const u = new URL(buildAuthUrl({ clientId: "cid", redirectUri: "https://x.app/api/google/callback", state: "st", challenge: "ch" }));
    expect(u.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/calendar.readonly");
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("state")).toBe("st");
  });
});

describe("token calls", () => {
  it("exchanges a code with the verifier", async () => {
    let body = "";
    const f: Fetch = async (_u, init) => { body = String(init?.body); return json(200, { access_token: "at", refresh_token: "rt", expires_in: 3600 }); };
    const t = await exchangeCode(f, { clientId: "c", clientSecret: "s", redirectUri: "r", code: "abc", verifier: "ver" });
    expect(t.refresh_token).toBe("rt");
    expect(body).toContain("code_verifier=ver");
    expect(body).toContain("grant_type=authorization_code");
  });
  it("flags a revoked refresh token as needing reconnect", async () => {
    const f: Fetch = async () => json(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." });
    await expect(refreshAccessToken(f, { clientId: "c", clientSecret: "s", refreshToken: "x" })).rejects.toMatchObject({ needsReconnect: true });
  });
});

describe("fetchEvents", () => {
  it("follows pages and returns the final sync token", async () => {
    const calls: string[] = [];
    const f: Fetch = async (url) => {
      calls.push(url);
      return url.includes("pageToken=p2") ? json(200, { items: [{ id: "b" }], nextSyncToken: "SYNC" }) : json(200, { items: [{ id: "a" }], nextPageToken: "p2" });
    };
    const r = await fetchEvents(f, { accessToken: "at", calendarId: "primary", timeMin: "2026-09-01T00:00:00Z", timeMax: "2027-01-01T00:00:00Z" });
    expect(r.events.map((e) => e.id)).toEqual(["a", "b"]);
    expect(r.nextSyncToken).toBe("SYNC");
    expect(calls[0]).toContain("timeMin=");
  });
  it("never sends timeMin with a syncToken", async () => {
    let url = "";
    const f: Fetch = async (u) => { url = u; return json(200, { items: [], nextSyncToken: "S2" }); };
    await fetchEvents(f, { accessToken: "at", calendarId: "primary", syncToken: "S1", timeMin: "2026-09-01T00:00:00Z" });
    expect(url).toContain("syncToken=S1");
    expect(url).not.toContain("timeMin");
  });
  it("surfaces 410 as a gone sync token", async () => {
    const f: Fetch = async () => json(410, { error: { message: "Sync token is no longer valid" } });
    const err = await fetchEvents(f, { accessToken: "at", calendarId: "primary", syncToken: "old" }).catch((e) => e);
    expect(err).toBeInstanceOf(GoogleError);
    expect((err as GoogleError).isGone).toBe(true);
  });
});

describe("mapGoogleEvent", () => {
  const tz = "Europe/Zurich";
  it("keeps timed events as instants", () => {
    const m = mapGoogleEvent("primary", { id: "e1", summary: "Lab meeting", start: { dateTime: "2026-10-19T09:00:00+02:00" }, end: { dateTime: "2026-10-19T10:00:00+02:00" } }, tz);
    expect(m).toMatchObject({ id: "primary|e1", allDay: false, cancelled: false, summary: "Lab meeting" });
    expect(m.startAt?.toISOString()).toBe("2026-10-19T07:00:00.000Z");
  });
  it("anchors all-day events at local midnight", () => {
    const m = mapGoogleEvent("primary", { id: "e2", summary: "Holiday", start: { date: "2026-10-20" }, end: { date: "2026-10-21" } }, tz);
    expect(m.allDay).toBe(true);
    expect(m.startAt?.toISOString()).toBe("2026-10-19T22:00:00.000Z"); // 00:00 CEST
  });
  it("marks cancelled events", () => {
    expect(mapGoogleEvent("primary", { id: "e3", status: "cancelled" }, tz).cancelled).toBe(true);
  });
});
