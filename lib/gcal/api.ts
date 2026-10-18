import { pkcePair, randomState } from "@/lib/gcal/crypto";

export const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const EVENTS = (calendarId: string) => `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export function buildAuthUrl(opts: { clientId: string; redirectUri: string; state: string; challenge: string }): string {
  const u = new URL(AUTH);
  u.search = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: opts.state,
    code_challenge: opts.challenge,
    code_challenge_method: "S256",
  }).toString();
  return u.toString();
}

export function newAuthRequest(clientId: string, redirectUri: string) {
  const { verifier, challenge } = pkcePair();
  const state = randomState();
  return { state, verifier, url: buildAuthUrl({ clientId, redirectUri, state, challenge }) };
}

export type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };

async function tokenCall(f: Fetch, params: Record<string, string>): Promise<TokenResponse> {
  const res = await f(TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString() });
  const body = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new GoogleError(res.status, body.error_description ?? body.error ?? "token request failed", body.error);
  return body as TokenResponse;
}

export const exchangeCode = (f: Fetch, p: { clientId: string; clientSecret: string; redirectUri: string; code: string; verifier: string }) =>
  tokenCall(f, { grant_type: "authorization_code", code: p.code, client_id: p.clientId, client_secret: p.clientSecret, redirect_uri: p.redirectUri, code_verifier: p.verifier });

export const refreshAccessToken = (f: Fetch, p: { clientId: string; clientSecret: string; refreshToken: string }) =>
  tokenCall(f, { grant_type: "refresh_token", refresh_token: p.refreshToken, client_id: p.clientId, client_secret: p.clientSecret });

export class GoogleError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
  /** Sync token expired or invalid: wipe the cache and start over. */
  get isGone() {
    return this.status === 410;
  }
  /** Refresh token revoked or expired: the user must reconnect. */
  get needsReconnect() {
    return this.code === "invalid_grant";
  }
}

import type { GoogleEvent } from "@/lib/gcal/map";

export type EventsPage = { events: GoogleEvent[]; nextSyncToken: string | null };

/**
 * Pull every event for a calendar, following pages. With a syncToken it returns only changes
 * (including cancellations); without one it returns the window [timeMin, timeMax].
 * Google rejects timeMin/timeMax alongside a syncToken, so they are only sent on a full sync.
 */
export async function fetchEvents(
  f: Fetch,
  p: { accessToken: string; calendarId: string; syncToken?: string | null; timeMin?: string; timeMax?: string },
): Promise<EventsPage> {
  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;
  do {
    const q = new URLSearchParams({ singleEvents: "true", maxResults: "250", showDeleted: "true" });
    if (p.syncToken) q.set("syncToken", p.syncToken);
    else {
      if (p.timeMin) q.set("timeMin", p.timeMin);
      if (p.timeMax) q.set("timeMax", p.timeMax);
    }
    if (pageToken) q.set("pageToken", pageToken);
    const res = await f(`${EVENTS(p.calendarId)}?${q}`, { headers: { Authorization: `Bearer ${p.accessToken}` } });
    const body = (await res.json().catch(() => ({}))) as { items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string; error?: { message?: string } };
    if (!res.ok) throw new GoogleError(res.status, body.error?.message ?? `events request failed (${res.status})`);
    events.push(...(body.items ?? []));
    pageToken = body.nextPageToken;
    if (body.nextSyncToken) nextSyncToken = body.nextSyncToken;
  } while (pageToken);
  return { events, nextSyncToken };
}
