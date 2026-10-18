import type { Metadata } from "next";
import { Tile } from "@/components/ui/tile";
import { Label, Mono, Rule } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/services/settings";
import { updateSettings } from "@/app/actions/settings";
import { disconnect, syncNow } from "@/app/actions/google";
import { connectionStatus, isGoogleConfigured } from "@/lib/services/gcal";
import { formatDistanceToNow } from "date-fns";

export const metadata: Metadata = { title: "Settings" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const input = "w-full rounded-[8px] border border-line bg-transparent px-3 py-[9px] text-[14px]";

function Status({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <div className="leader flex items-center justify-between gap-3 py-3 text-[14px] last:border-b-0">
      <span>{label}{hint ? <span className="mt-[2px] block text-[12px] text-muted">{hint}</span> : null}</span>
      <Mono className={ok ? "text-text" : "text-muted"}>{ok ? "ON" : "NOT SET"}</Mono>
    </div>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const user = await requireUser();
  const settings = await getSettings();
  const env = (k: string) => Boolean(process.env[k]);
  const gcal = await connectionStatus(user.id).catch(() => ({ connected: false, lastSyncedAt: null as Date | null, events: 0 }));
  const gconf = isGoogleConfigured();
  const GOOGLE_MSG: Record<string, string> = { connected: "Connected. Events are syncing.", synced: "Synced.", disconnected: "Disconnected and cached events removed.", denied: "Access was not granted.", failed: "Couldn't finish connecting. Check the Google setup in docs/SETUP.md.", "state-mismatch": "The sign-in request didn't match. Try again.", "sync-failed": "Sync failed. Try again in a minute.", reconnect: "Google access expired. Connect again.", "not-configured": "Google isn't configured yet." };
  const gmsg = typeof sp.google === "string" ? GOOGLE_MSG[sp.google] : undefined;

  return (
    <div className="grid gap-[14px] lg:grid-cols-2">
      <Tile>
        <Label>Preferences</Label>
        <Rule dotted />
        <form action={updateSettings} className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="label text-muted">Time zone</span>
            <input name="tz" defaultValue={settings.tz} list="tzs" className={input} />
            <datalist id="tzs">
              {["Europe/Zurich", "Europe/Berlin", "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "UTC"].map((z) => <option key={z} value={z} />)}
            </datalist>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label text-muted">Day starts at (hour)</span>
            <input name="dayStartHour" type="number" min={0} max={8} defaultValue={settings.dayStartHour} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label text-muted">Shutdown time</span>
            <input name="shutdownTime" type="time" defaultValue={settings.shutdownTime} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label text-muted">Planned hours a day</span>
            <input name="capacityHours" type="number" step="0.5" min={1} max={16} defaultValue={settings.dailyCapacityMin / 60} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label text-muted">Claude model</span>
            <select name="aiModel" defaultValue={settings.aiModel} className={input}>
              <option value="claude-sonnet-5-5">Sonnet 5.5 (fast, cheap)</option>
              <option value="claude-opus-5-5">Opus 5.5</option>
              <option value="claude-fable-5-1">Fable 5.1 (deepest)</option>
            </select>
          </label>
          <div className="flex items-center gap-4 sm:col-span-2">
            <Button type="submit">Save</Button>
            {sp.saved ? <Mono className="text-muted">SAVED</Mono> : null}
            {sp.error ? <Mono className="text-orange">CHECK THE VALUES</Mono> : null}
          </div>
        </form>
        <p className="mt-4 text-[13px] text-muted">
          A shutdown at 01:00 still belongs to the previous day until the hour you set above, so late evenings stay with the day they started.
        </p>
      </Tile>

      <div className="flex flex-col gap-[14px]">
        <Tile>
          <Label>Your data</Label>
          <Rule dotted />
          <p className="text-[14px] text-muted">Everything you enter is yours. Download it any time.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/api/export/json" className="inline-flex rounded-full border-[1.2px] border-text px-[18px] py-[9px] font-mono text-[12px] uppercase tracking-[0.04em]">Export JSON</a>
            <a href="/import" className="inline-flex rounded-full border border-line px-[18px] py-[9px] font-mono text-[12px] uppercase tracking-[0.04em] text-muted">Import</a>
            <a href="/api/export/markdown" className="inline-flex rounded-full border-[1.2px] border-text px-[18px] py-[9px] font-mono text-[12px] uppercase tracking-[0.04em]">Export Markdown vault</a>
          </div>
          <p className="mt-4 text-[13px] text-muted">The Markdown vault opens in Obsidian: one note per day, one per review, plus areas and goals.</p>
          <Status ok={env("SUPABASE_SERVICE_ROLE_KEY")} label="Nightly backup" hint="Needs SUPABASE_SERVICE_ROLE_KEY and a cron-job.org job for /api/cron/backup" />
        </Tile>

        <Tile>
          <Label>Connections</Label>
          <Rule dotted />
          <div className="leader py-3 text-[14px]">
            <div className="flex items-center justify-between gap-3">
              <span>Google Calendar<span className="mt-[2px] block text-[12px] text-muted">Read-only overlay on Week and Today</span></span>
              <Mono className={gcal.connected ? "text-text" : "text-muted"}>{gcal.connected ? "CONNECTED" : gconf ? "READY" : "NOT SET"}</Mono>
            </div>
            {gcal.connected ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Mono className="mr-2 text-muted">{gcal.events} EVENTS · {gcal.lastSyncedAt ? `SYNCED ${formatDistanceToNow(gcal.lastSyncedAt).toUpperCase()} AGO` : "NOT SYNCED YET"}</Mono>
                <form action={syncNow}><Button type="submit" variant="quiet">Sync now</Button></form>
                <form action={disconnect}><Button type="submit" variant="quiet">Disconnect</Button></form>
              </div>
            ) : gconf ? (
              <div className="mt-3"><a href="/api/google/start" className="inline-flex rounded-full border-[1.2px] border-text px-[18px] py-[9px] font-mono text-[12px] uppercase tracking-[0.04em]">Connect Google Calendar</a></div>
            ) : (
              <p className="mt-2 text-[12px] text-muted">Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and TOKEN_ENCRYPTION_KEY, then redeploy. Steps are in docs/SETUP.md.</p>
            )}
            {gmsg ? <p className="mt-2 text-[13px] text-orange">{gmsg}</p> : null}
          </div>
          <Status ok={env("ANTHROPIC_API_KEY")} label="Claude assistant" hint="Review drafts, top-3 proposals, brain dump" />
          <Status ok={env("NOTION_TOKEN")} label="Notion import" hint="Import pages and databases on the Import screen" />
          <Status ok={env("MCP_TOKEN")} label="Claude Code (MCP)" hint="Lets Claude Code read and write your Life OS" />
          <Status ok={env("VAPID_PUBLIC_KEY") && env("VAPID_PRIVATE_KEY")} label="Push reminders" />
        </Tile>

        <Tile dark>
          <Label>Account</Label>
          <Rule dotted />
          <Mono className="text-muted">{user.email}</Mono>
          <form action="/auth/signout" method="post" className="mt-4">
            <Button type="submit" variant="quiet">Sign out</Button>
          </form>
        </Tile>
      </div>
    </div>
  );
}
