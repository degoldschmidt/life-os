# Life OS setup

Life OS is a single-user Next.js app. It runs on Vercel, stores everything in Supabase, and you
sign in on each device with an emailed link or code. This guide lists the steps only you can do
(accounts, keys), in the order that gets you running fastest. Everything marked *optional* can wait.

## 1. Supabase

1. Create a project at https://supabase.com/dashboard (a region near you).
   - Security: **uncheck** "Automatically expose new tables", **check** "Enable automatic RLS".
2. Project settings → API: copy the **Project URL** (base address only, no `/rest/v1/`) and the **publishable key**.
3. Connect (top of the project page) → copy the **transaction pooler** string (port 6543) for the app and the **session pooler** string (port 5432) for migrations. Put your database password into both.
4. Authentication → URL configuration: set **Site URL** to your Vercel address and add redirect URLs
   `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback`.
5. Authentication → Emails → Templates. Edit **Magic link** and **Confirm signup**, same body in both:

   ```html
   <h2>Sign in to Life OS</h2>
   <p><a href="{{ .ConfirmationURL }}">Sign in with this link</a></p>
   <p>Or enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```

   The code matters on iPhone and iPad: a link opens Safari, not the installed Home Screen app, so
   inside the installed app you sign in by typing the code.
6. Free projects share a tiny built-in email allowance (a few per hour). For reliable delivery set up
   custom SMTP: Authentication → Emails → SMTP Settings, for example with Resend (free):
   host `smtp.resend.com`, port `465`, user `resend`, password = a Resend API key, sender
   `onboarding@resend.dev` (it can deliver to the address you registered with).

## 2. Local environment

```bash
cp .env.example .env.local     # then fill in the values below
pnpm install
pnpm db:migrate                # applies drizzle/*.sql to Supabase
pnpm dev                       # http://localhost:3000
```

Sign in once, then create your areas, settings and review templates:

```bash
pnpm db:seed
```

## 3. Vercel

1. Import the GitHub repo at https://vercel.com/new (Next.js, pnpm).
2. Add environment variables (Production). **Secret** = mark as secret/sensitive.

| Variable | Needed | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | base URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | |
| `DATABASE_URL` | yes, secret | transaction pooler, port 6543 |
| `DIRECT_DATABASE_URL` | yes, secret | session pooler, port 5432 |
| `AUTH_ALLOWED_EMAIL` | yes | the one email that may sign in |
| `NEXT_PUBLIC_SITE_URL` | yes, **Production only** | your production address, no trailing slash |
| `CRON_SECRET` | yes, secret | `openssl rand -hex 32` |
| `SUPABASE_SERVICE_ROLE_KEY` | for backups, secret | Project settings → API |
| `ANTHROPIC_API_KEY` | for Claude features, secret | https://console.anthropic.com |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | for Google Calendar, secret | section 6 |
| `TOKEN_ENCRYPTION_KEY` | for Google Calendar, secret | `openssl rand -base64 32` |
| `NOTION_TOKEN` | for Notion import, secret | section 6 |
| `MCP_TOKEN` | for Claude Code, secret | `openssl rand -hex 32` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | for reminders | already generated in your `.env.local`; copy the same values |

3. Deploy, copy the production address, set it as `NEXT_PUBLIC_SITE_URL`, redeploy.
4. Use the **production domain** (Settings → Domains) everywhere: the Home Screen icon, cron jobs and
   Supabase. Per-deployment URLs change on every deploy and are behind a Vercel login.

## 4. Scheduler (required)

Vercel Hobby cron runs once a day and Supabase pauses free projects after 7 idle days, so a free
external scheduler calls Life OS instead. At https://cron-job.org create these jobs, each sending
the header `Authorization: Bearer <CRON_SECRET>`:

| Job URL | How often | Purpose |
|---|---|---|
| `/api/cron/heartbeat` | every 10 minutes | keeps Supabase awake (required) |
| `/api/cron/reminders` | every 5 minutes | plan, shutdown and Friday review notifications |
| `/api/cron/calendar-sync` | every 10 minutes | Google Calendar |
| `/api/cron/backup` | once a day | JSON backup to Supabase Storage |

Use `https://<production-domain>/api/cron/<job>` with no trailing slash. A job you don't use yet
simply reports `skipped`. Run each once by hand and look for `"ok":true`.

## 5. Install on your devices

- **iPhone / iPad:** open the production address in **Safari**, sign in, Share → **Add to Home
  Screen**. Open it from the new icon and sign in once more with the emailed **code**.
- **Mac:** Safari → File → **Add to Dock**.

## 6. Optional integrations

### Claude assistant
Add `ANTHROPIC_API_KEY`. Settings → Claude model picks Sonnet 5.5 (default, cheap), Opus 5.5 or
Fable 5.1. You get review drafts, Top 3 suggestions and smart brain-dump sorting. Typical cost is a
few cents a week; every call is logged in the `ai_runs` table and capped at 40 per hour.

### Google Calendar (read-only)
1. https://console.cloud.google.com → create a project → APIs & Services → enable **Google Calendar API**.
2. OAuth consent screen: User type **External**, add your email as a test user. Then **publish the app**
   (Production). Unverified personal apps get a warning screen you can click through; in *Testing*
   status Google expires the connection every 7 days.
3. Credentials → Create credentials → OAuth client ID → **Web application**. Authorised redirect URIs:
   `https://<production-domain>/api/google/callback` and `http://localhost:3000/api/google/callback`.
4. Put the client ID and secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, add
   `TOKEN_ENCRYPTION_KEY`, redeploy, then Settings → **Connect Google Calendar**.

### Claude Code (MCP)
Set `MCP_TOKEN`, redeploy, then register the server once:

```bash
claude mcp add --transport http life-os https://<production-domain>/api/mcp \
  --header "Authorization: Bearer <MCP_TOKEN>"
```

Then ask Claude Code things like "plan my week from Life OS", "add these five tasks to my inbox",
"draft my weekly review". It can read today, tasks, goals, habits, review facts and trends, and write
tasks, habit logs, journal lines, notes and review drafts. It never overwrites answers you wrote and
never finishes a review for you.

### Notion
https://www.notion.so/profile/integrations → New integration (internal) → copy the token into
`NOTION_TOKEN`. In Notion, open each page or database you want and choose ••• → Connections → add the
integration. Then Import → Find pages.

### Apple Notes
Import → download the export script, open it in Script Editor, press Run, then upload the files it
writes to `Desktop/AppleNotesExport`. Markdown and text files from Obsidian work the same way.

### Push reminders
Keys are already in your `.env.local`; copy them to Vercel. On the iPhone, open the Home Screen app →
Settings → **Turn on for this device**. Notifications only work from the installed app. The
`/api/cron/reminders` job (every 5 minutes) sends them.

### Backups
Add `SUPABASE_SERVICE_ROLE_KEY`; the daily `backup` job keeps the newest 30 JSON files in a private
Storage bucket named `backups`. Settings also has one-click JSON and Markdown-vault downloads.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | dev server |
| `pnpm check` | typecheck + lint + unit tests |
| `pnpm build && pnpm e2e` | production build + Playwright at phone, tablet and desktop sizes |
| `pnpm db:generate` / `db:migrate` / `db:seed` | schema migrations and seed |
| `node scripts/make-icons.mjs` | regenerate PWA icons from the SVGs |
