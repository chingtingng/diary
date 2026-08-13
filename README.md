# Daybook

A lightweight personal daybook — journal your days, track moods, and log expenses in one quiet place. Install it on your iPhone home screen as a PWA, write with automatic timestamps, and export everything as plain text.

## Features

- **Journal mode** — daily pages with auto-save and mood tags
- **Mood calendar** — colour-tagged calendar / mood board
- **Expenses mode** — log spending by category with monthly totals
- **Export** — download journal entries or expenses as `.txt`
- **PWA support** — add to iPhone/Android home screen
- **Supabase sync** — access your daybook across devices (optional)
- **Local mode** — works immediately without setup (data stored in browser)

## Quick Start (Local Mode)

No setup required — just run the app and start writing. Data is saved in your browser's local storage.

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

Use the header tabs — **Journal**, **Calendar**, and **Expenses** — to move between views.

## Supabase Setup (Cloud Sync)

For syncing across devices, set up Supabase:

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Run the database migrations

In the Supabase SQL Editor, run the contents of:

```
supabase/migrations/001_create_entries.sql
supabase/migrations/002_add_mood.sql
supabase/migrations/003_create_expenses.sql
supabase/migrations/004_add_travel_category.sql
supabase/migrations/005_replace_home_with_hobbies.sql
supabase/migrations/006_drop_fun_category.sql
```

These create the `entries` and `expenses` tables with row-level security so each user only sees their own data.

**Expenses date + time:** `spent_at` is already a `timestamptz`, so no extra migration is needed to store time of day. The app writes a full timestamp when you set date and time in the UI.

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your project credentials (found in **Project Settings → API**):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Enable email auth (used under the hood for username login)

In Supabase Dashboard → **Authentication → Providers**, enable Email.

**Important:** Turn **off** “Confirm email” so username signup works without a real inbox.
The app maps usernames to synthetic emails like `you@diary.local` — you only ever type a username.

Restart the dev server after adding `.env`.

## Add to iPhone Home Screen

1. Deploy the app (see below) or use a local tunnel for testing
2. Open the app in **Safari**
3. Tap the **Share** button → **Add to Home Screen**
4. The app opens full-screen like a native app

## Deploy

Build for production:

```bash
npm install
npm run build
```

Deploy the `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages, etc.). Set the `VITE_SUPABASE_*` environment variables in your host's dashboard.

## Tech Stack

- **Vite + React + TypeScript** — fast, lightweight frontend
- **Supabase** — Postgres database, auth, and sync
- **vite-plugin-pwa** — offline support and installability

## Mood calendar

Tag each journal entry with a mood emoji (Great / Good / Okay / Low / Rough). The **Calendar** tab colours each day and shows the emoji so you can see your emotional landscape at a glance.

After deploying, run this in the Supabase SQL Editor if you use cloud sync and have not already:

```sql
alter table public.entries
  add column if not exists mood text
  check (mood is null or mood in ('great', 'good', 'okay', 'low', 'rough'));
```
