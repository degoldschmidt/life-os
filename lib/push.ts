import webpush from "web-push";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let ready = false;
function configure(): boolean {
  if (ready) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? `mailto:${process.env.AUTH_ALLOWED_EMAIL ?? "admin@example.com"}`, pub, priv);
  ready = true;
  return true;
}

export type PushPayload = { title: string; body: string; url: string };

/** Push to every device the user subscribed. Dead subscriptions (404/410) are removed on the spot. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; removed: number; failed: number }> {
  const result = { sent: 0, removed: 0, failed: 0 };
  if (!configure()) return result;
  const subs = await db().select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, userId));
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 3600, urgency: "normal" });
      result.sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db().delete(schema.pushSubscriptions).where(and(eq(schema.pushSubscriptions.userId, userId), eq(schema.pushSubscriptions.endpoint, s.endpoint)));
        result.removed++;
      } else {
        console.error("[push] send failed:", status, (e as Error).message);
        result.failed++;
      }
    }
  }
  return result;
}
