# Count My Push

Minimal single-user pushup tracker: React + Vite on Vercel, Postgres on [Neon](https://neon.tech). Log sets with one tap, track daily / weekly / monthly goals, and tune quick-add amounts in settings.

## Prerequisites

- [pnpm](https://pnpm.io) (version pinned via `packageManager` in `package.json`; enable with `corepack enable`)
- A Neon database and its connection string

## Setup

1. **Create the database tables** — run [`db/001_init.sql`](db/001_init.sql) in the Neon SQL editor (or `psql`).

2. **Environment** — copy `.env.example` to `.env` and set `DATABASE_URL` to your Neon connection string (include `?sslmode=require` if your provider expects it).

3. **Install and run**

   ```bash
   pnpm install
   ```

   - **UI only (no API):** `pnpm dev` — Vite dev server; `/api` calls are proxied to `http://localhost:3000` when something is listening there.
   - **UI + API locally:** `pnpm dev:api` — runs `vercel dev` so serverless routes under `/api` work with your `.env`.

4. **Production (Vercel)** — link the repo, set the `DATABASE_URL` environment variable for Production (and Preview if you want), then deploy. Vercel uses `pnpm install` and `pnpm run build` from [`vercel.json`](vercel.json).

## API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/state?tz=…` | Goals, quick-add amounts, totals (browser `Intl` time zone), recent entries |
| `POST` | `/api/entries` | Body: `{ "count": number }` |
| `DELETE` | `/api/entries?id=…` | Remove one log row |
| `PATCH` | `/api/goals` | Body: `{ "dailyGoal"?, "weeklyGoal"?, "monthlyGoal"? }` (at least one field) |
| `PATCH` | `/api/settings` | Body: `{ "quickAdd": number[] }` (2–4 values, each 1–500) |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Vite dev server |
| `pnpm dev:api` | `vercel dev` (frontend + `/api`) |
| `pnpm build` | Typecheck + production bundle |
| `pnpm lint` | ESLint |
| `pnpm preview` | Preview the production build |
