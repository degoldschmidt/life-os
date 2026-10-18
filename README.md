# Life OS

One system to plan and review work and life. Single user, runs on iPhone, iPad and Mac as an
installable web app with data synced through Supabase.

- **Plan:** Today (Top 3, habits, calendar), a morning plan flow, Week with drag-and-drop time blocks, Goals by life area, quick capture.
- **Review:** daily shutdown, weekly review, monthly, quarterly and annual rituals as guided steppers, plus Trends.
- **Assist:** Claude drafts reviews and suggests the Top 3; Claude Code can read and write your data through an MCP server.
- **Connect:** Google Calendar (read-only), Notion and Apple Notes import, push reminders, JSON and Markdown export, nightly backup.
- **Design:** Braun / Dieter Rams instrument bento, light and dark. See `docs/renders/life-os-renders.html`.

## Stack

Next.js 16 (App Router, TypeScript) · Supabase Postgres and Auth · Drizzle ORM · Tailwind 4 ·
Recharts · Anthropic SDK · MCP SDK · web-push · Vitest · Playwright · Vercel.

## Getting started

Follow [docs/SETUP.md](docs/SETUP.md), then read [docs/USING.md](docs/USING.md).

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase values and AUTH_ALLOWED_EMAIL
pnpm db:migrate && pnpm db:seed
pnpm dev
```

## Project layout

```
app/            routes (today, plan, shutdown, week, goals, habits, journal, review, setup, import, settings, api)
components/     ui kit and per-feature client components
lib/db          Drizzle schema and client
lib/services    data access shared by server actions, the MCP server and background jobs
lib/ai, gcal, notion, mcp, import   integrations
lib/jobs        scheduled work, triggered through /api/cron/<job>
drizzle/        SQL migrations
docs/           setup and usage guides, approved renders
tests/          unit (Vitest) and e2e (Playwright)
```
