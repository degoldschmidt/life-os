import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/gcal/crypto";
import { fetchEvents, GoogleError, refreshAccessToken, type Fetch, type TokenResponse } from "@/lib/gcal/api";
import { mapGoogleEvent } from "@/lib/gcal/map";

const { oauthTokens, syncState, calendarEvents } = schema;
const PROVIDER = "google_calendar";

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.TOKEN_ENCRYPTION_KEY);
}

export async function connectionStatus(userId: string): Promise<{ connected: boolean; lastSyncedAt: Date | null; events: number }> {
  const [tok] = await db().select({ id: oauthTokens.id }).from(oauthTokens).where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, PROVIDER))).limit(1);
  if (!tok) return { connected: false, lastSyncedAt: null, events: 0 };
  const states = await db().select({ at: syncState.lastSyncedAt }).from(syncState).where(and(eq(syncState.userId, userId), eq(syncState.provider, PROVIDER)));
  const last = states.map((s) => s.at).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const events = await db().select({ id: calendarEvents.id }).from(calendarEvents).where(eq(calendarEvents.userId, userId));
  return { connected: true, lastSyncedAt: last, events: events.length };
}

/** Store tokens encrypted. Google only returns a refresh token on the first consent, so keep the old one otherwise. */
export async function saveTokens(userId: string, t: TokenResponse): Promise<void> {
  const [existing] = await db().select().from(oauthTokens).where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, PROVIDER))).limit(1);
  const refreshEnc = t.refresh_token ? encrypt(t.refresh_token) : existing?.refreshTokenEnc ?? null;
  const values = {
    userId,
    provider: PROVIDER,
    accessTokenEnc: encrypt(t.access_token),
    refreshTokenEnc: refreshEnc,
    expiresAt: new Date(Date.now() + t.expires_in * 1000),
    scope: t.scope ?? null,
    updatedAt: new Date(),
  };
  await db().insert(oauthTokens).values(values).onConflictDoUpdate({ target: [oauthTokens.userId, oauthTokens.provider], set: values });
}

async function accessToken(userId: string, f: Fetch): Promise<string> {
  const [row] = await db().select().from(oauthTokens).where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, PROVIDER))).limit(1);
  if (!row) throw new Error("Google Calendar is not connected");
  if (row.expiresAt && row.expiresAt.getTime() - 60_000 > Date.now()) return decrypt(row.accessTokenEnc);
  if (!row.refreshTokenEnc) throw new GoogleError(400, "No refresh token stored", "invalid_grant");
  try {
    const t = await refreshAccessToken(f, {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      refreshToken: decrypt(row.refreshTokenEnc),
    });
    await saveTokens(userId, t);
    return t.access_token;
  } catch (e) {
    if (e instanceof GoogleError && e.needsReconnect) await disconnectGoogle(userId);
    throw e;
  }
}

export type SyncResult = { calendars: number; upserted: number; removed: number; fullSyncs: number };

/**
 * Pull changes for each synced calendar (default: the primary one) into the local cache.
 * Uses Google's incremental sync tokens; a 410 means the token expired, so wipe and start over.
 */
export async function syncGoogleCalendar(userId: string, tz: string, f: Fetch = fetch): Promise<SyncResult> {
  const token = await accessToken(userId, f);
  let states = await db().select().from(syncState).where(and(eq(syncState.userId, userId), eq(syncState.provider, PROVIDER)));
  if (states.length === 0) {
    await db().insert(syncState).values({ userId, provider: PROVIDER, resourceId: "primary" });
    states = await db().select().from(syncState).where(and(eq(syncState.userId, userId), eq(syncState.provider, PROVIDER)));
  }

  const result: SyncResult = { calendars: states.length, upserted: 0, removed: 0, fullSyncs: 0 };
  for (const st of states) {
    const window = {
      timeMin: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      timeMax: new Date(Date.now() + 120 * 86_400_000).toISOString(),
    };
    // No token yet: full sync over a window. With a token: only what changed since.
    const full = !st.syncToken;
    let page;
    if (full) {
      page = await fetchEvents(f, { accessToken: token, calendarId: st.resourceId, ...window });
      result.fullSyncs++;
    } else {
      try {
        page = await fetchEvents(f, { accessToken: token, calendarId: st.resourceId, syncToken: st.syncToken });
      } catch (e) {
        // 410: the token expired. Wipe this calendar's cache and start over.
        if (!(e instanceof GoogleError) || !e.isGone) throw e;
        await db().delete(calendarEvents).where(and(eq(calendarEvents.userId, userId), eq(calendarEvents.calendarId, st.resourceId)));
        page = await fetchEvents(f, { accessToken: token, calendarId: st.resourceId, ...window });
        result.fullSyncs++;
      }
    }

    const mapped = page.events.map((ev) => mapGoogleEvent(st.resourceId, ev, tz));
    const gone = mapped.filter((m) => m.cancelled).map((m) => m.id);
    if (gone.length) {
      await db().delete(calendarEvents).where(and(eq(calendarEvents.userId, userId), inArray(calendarEvents.id, gone)));
      result.removed += gone.length;
    }
    for (const m of mapped.filter((m) => !m.cancelled)) {
      const row = { id: m.id, userId, calendarId: m.calendarId, etag: m.etag, summary: m.summary, startAt: m.startAt, endAt: m.endAt, allDay: m.allDay, status: m.status, updatedAt: new Date() };
      await db().insert(calendarEvents).values(row).onConflictDoUpdate({ target: calendarEvents.id, set: row });
      result.upserted++;
    }
    await db().update(syncState).set({ syncToken: page.nextSyncToken ?? st.syncToken, lastSyncedAt: new Date() }).where(eq(syncState.id, st.id));
  }
  return result;
}

export async function disconnectGoogle(userId: string): Promise<void> {
  await db().delete(oauthTokens).where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, PROVIDER)));
  await db().delete(syncState).where(and(eq(syncState.userId, userId), eq(syncState.provider, PROVIDER)));
  await db().delete(calendarEvents).where(eq(calendarEvents.userId, userId));
}
