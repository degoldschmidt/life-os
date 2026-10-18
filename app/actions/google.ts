"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/services/settings";
import { disconnectGoogle, syncGoogleCalendar } from "@/lib/services/gcal";
import { GoogleError } from "@/lib/gcal/api";

export async function syncNow() {
  const user = await requireUser();
  const settings = await getSettings();
  try {
    await syncGoogleCalendar(user.id, settings.tz);
  } catch (e) {
    console.error("[google] manual sync failed:", e);
    redirect(`/settings?google=${e instanceof GoogleError && e.needsReconnect ? "reconnect" : "sync-failed"}`);
  }
  revalidatePath("/", "layout");
  redirect("/settings?google=synced");
}

export async function disconnect() {
  const user = await requireUser();
  await disconnectGoogle(user.id);
  revalidatePath("/", "layout");
  redirect("/settings?google=disconnected");
}
