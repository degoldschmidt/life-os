# Life OS

One system to plan and review work and life. Single user, runs on iPhone, iPad and Mac as an
installable web app with data synced through Supabase.

- **Plan:** Today (Top 3, time blocks, habits), Week, Goals by life area, quick capture.
- **Review:** daily shutdown, weekly review, monthly, quarterly and annual rituals as guided
  steppers, with trends only where you reflect.
- **Design:** Braun / Dieter Rams instrument bento. Paper background, black instrument tiles,
  one orange, monospace labels, thin numerals. See `docs/renders/life-os-renders.html`.

## Stack

Next.js 16 (App Router, TypeScript) · Supabase Postgres, Auth and Realtime · Drizzle ORM ·
Tailwind 4 · Vitest · Playwright · Vercel.

## Getting started

See [docs/SETUP.md](docs/SETUP.md) for the Supabase and Vercel setup, then:

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase values and AUTH_ALLOWED_EMAIL
pnpm db:migrate
pnpm dev
```

## Project layout

```
app/            routes (today, week, goals, habits, journal, review, inbox, login, auth, api)
components/     ui kit (Tile, Row, DotGrid, ThinNumber, Meter, Stepper) and app shell
lib/db          Drizzle schema and client (the only place that talks to Postgres via services)
lib/services    data access used by server actions, MCP tools and cron routes
lib/rituals     versioned review templates and default areas
drizzle/        SQL migrations
docs/           setup guide and approved renders
tests/          unit (Vitest) and e2e (Playwright)
```

## Build phases

0. Foundation: shell, auth, schema, PWA, CI ← current
1. Core objects and Today
2. Daily loop: time blocks, habits, journal, daily plan and shutdown
3. Reviews, goals and trends
4. Integrations: Google Calendar, Claude, MCP for Claude Code, Notion / Apple Notes import
5. Polish: dark theme, two-way calendar, offline queue
