# Life OS setup

Life OS is a single-user Next.js PWA. You run it on Vercel with a Supabase project behind it
and sign in on each device with a magic link. This document lists the one-time steps that only
you can do (accounts, keys), then the commands to run.

## 1. Supabase

1. Create a project at https://supabase.com/dashboard (region close to you, e.g. Frankfurt).
2. Project settings → API: copy the **Project URL** and the **publishable key**.
3. Project settings → Database → Connection string:
   - **Transaction pooler** (port 6543) → `DATABASE_URL` (used by the app)
   - **Session pooler** or direct (port 5432) → `DIRECT_DATABASE_URL` (used by migrations)
4. Authentication → Providers → Email: keep **Email** enabled, enable **Magic link**.
   Optional hardening: Authentication → Settings → turn off "Allow new users to sign up"
   *after* your first login (the app enforces the allowlist regardless).
5. Authentication → URL configuration:
   - Site URL: your production URL (e.g. `https://life-os.vercel.app`)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://<your-domain>/auth/callback`
6. Authentication → Emails → Templates. Edit **both** "Magic link" and "Confirm signup" and make the body contain the link and the code:

   ```html
   <h2>Sign in to Life OS</h2>
   <p><a href="{{ .ConfirmationURL }}">Sign in with this link</a></p>
   <p>Or enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```

   The code matters on iPhone and iPad: a link opens Safari, not the installed Home Screen app,
   so inside the installed app you sign in by typing the code instead.
7. Free projects share a small built-in email allowance. For reliable delivery set up custom
   SMTP (Authentication → Emails → SMTP Settings), for example Resend with the sender
   `onboarding@resend.dev`, which can deliver to the email you registered with.

## 2. Local environment

```bash
cp .env.example .env.local
```

Fill in the Supabase values and set `AUTH_ALLOWED_EMAIL` to the one email that may sign in.
Then:

```bash
pnpm install
pnpm db:migrate      # applies drizzle/*.sql to Supabase
pnpm dev             # http://localhost:3000
```

Sign in once with the magic link (this creates your row in `auth.users`), then seed areas,
settings and ritual templates:

```bash
pnpm db:seed
```

## 3. Vercel

1. Import the GitHub repo at https://vercel.com/new (framework: Next.js, package manager: pnpm).
2. Add the same environment variables as `.env.local`, with `NEXT_PUBLIC_SITE_URL` set to the
   production URL.
3. Deploy. Preview deployments get their own URLs; add them to Supabase redirect URLs if you
   want to sign in on previews.

## 4. External scheduler (required)

Vercel's Hobby plan runs cron jobs at most once a day, and Supabase pauses free projects
after seven days without API activity. Life OS therefore exposes its scheduled jobs as HTTP
endpoints and lets a free external scheduler call them:

```
GET https://<your-domain>/api/cron/heartbeat      every 10 minutes
GET https://<your-domain>/api/cron/calendar-sync  every 10 minutes (phase 4)
GET https://<your-domain>/api/cron/reminders      every 5 minutes (phase 2)
```

Each request must carry the header `Authorization: Bearer <CRON_SECRET>`.

1. Generate a secret: `openssl rand -hex 32`. Put it in `.env.local` and in Vercel as `CRON_SECRET`.
2. Create a free account at https://cron-job.org (or use any scheduler that can send a header,
   for example a GitHub Actions `schedule` workflow or Uptime Kuma).
3. Add a job per endpoint above: method GET, schedule as listed, and under Advanced add the
   request header `Authorization` with value `Bearer <your secret>`.
4. Run the heartbeat job once by hand; the response is JSON with `ok: true`, the database
   time and the Supabase API status.

The heartbeat is what keeps the Supabase free project awake while you are on holiday. Listing
the jobs without a token returns 401; an unknown job name returns 404 with the known names.

## 5. Install on your devices

- **iPhone / iPad:** open the production URL in Safari → Share → **Add to Home Screen**.
  The app runs standalone, and Web Push works from the installed icon (phase 2).
- **Mac:** Safari → File → **Add to Dock**, or use it in any browser.

## 6. Later phases (keys you will need)

| Phase | Secret | Where to get it |
|---|---|---|
| 4 | `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| 4 | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud → OAuth client (Web), redirect `https://<domain>/api/google/callback`; publish the consent screen to **Production** or refresh tokens expire after 7 days |
| 4 | `NOTION_TOKEN` | Notion → Settings → Integrations → internal integration; share the pages/databases with it |
| 0 | `CRON_SECRET` | `openssl rand -hex 32`; shared with the external scheduler |
| 4 | `MCP_TOKEN` | any long random string; used by Claude Code to call `/api/mcp` |
| 4 | `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32`; encrypts OAuth tokens at rest |
| 2 | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `pnpm dlx web-push generate-vapid-keys` |

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | dev server |
| `pnpm check` | typecheck + lint + unit tests |
| `pnpm build && pnpm e2e` | production build + Playwright at phone/tablet/desktop |
| `pnpm db:generate` | new migration from `lib/db/schema.ts` |
| `pnpm db:migrate` | apply migrations |
| `pnpm db:seed` | seed areas, settings, templates (idempotent) |
| `node scripts/make-icons.mjs` | regenerate PWA icons from the SVGs |
