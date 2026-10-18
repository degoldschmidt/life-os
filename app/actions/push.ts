"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { pushConfigured, sendPushToUser } from "@/lib/push";

const sub = z.object({ endpoint: z.url().max(1000), keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }) });

export async function savePushSubscription(raw: unknown, userAgent: string) {
  const user = await requireUser();
  const s = sub.parse(raw);
  await db()
    .insert(schema.pushSubscriptions)
    .values({ userId: user.id, endpoint: s.endpoint, keys: s.keys, userAgent: userAgent.slice(0, 300) })
    .onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: { userId: user.id, keys: s.keys, userAgent: userAgent.slice(0, 300) } });
}

export async function removePushSubscription(endpoint: string) {
  const user = await requireUser();
  await db().delete(schema.pushSubscriptions).where(and(eq(schema.pushSubscriptions.userId, user.id), eq(schema.pushSubscriptions.endpoint, z.url().parse(endpoint))));
}

export async function sendTestPush(): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  if (!pushConfigured()) return { ok: false, message: "Push isn't configured on the server yet." };
  const r = await sendPushToUser(user.id, { title: "Life OS", body: "Notifications work on this device.", url: "/settings" });
  if (r.sent > 0) return { ok: true, message: `Sent to ${r.sent} device${r.sent === 1 ? "" : "s"}.` };
  return { ok: false, message: r.removed ? "That device's subscription had expired. Enable notifications again." : "No device is subscribed yet." };
}
