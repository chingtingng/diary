# My Diary

A lightweight personal diary web app — like iPhone Notes, but built for daily thoughts. Install it on your iPhone home screen as a PWA, write entries with automatic timestamps, and export everything as plain text.

## Features

- **Daily entries** with automatic date and time stamps
- **Auto-save** as you type
- **Export all entries** as a `.txt` file
- **PWA support** — add to iPhone/Android home screen
- **Supabase sync** — access your diary across devices (optional)
- **Local mode** — works immediately without setup (data stored in browser)

## Quick Start (Local Mode)

No setup required — just run the app and start writing. Entries are saved in your browser's local storage.

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Supabase Setup (Cloud Sync)

For syncing across devices, set up Supabase:

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Run the database migration

In the Supabase SQL Editor, run the contents of:

```
supabase/migrations/001_create_entries.sql
```

This creates the `entries` table with row-level security so each user only sees their own entries.

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your project credentials (found in **Project Settings → API**):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Enable email auth

In Supabase Dashboard → **Authentication → Providers**, enable Email provider.

Restart the dev server after adding `.env`.

## Add to iPhone Home Screen

1. Deploy the app (see below) or use a local tunnel for testing
2. Open the app in **Safari**
3. Tap the **Share** button → **Add to Home Screen**
4. The app opens full-screen like a native app

## Deploy

Build for production:

```bash
npm run build
```

Deploy the `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages, etc.). Set the `VITE_SUPABASE_*` environment variables in your host's dashboard.

## Tech Stack

- **Vite + React + TypeScript** — fast, lightweight frontend
- **Supabase** — Postgres database, auth, and sync
- **vite-plugin-pwa** — offline support and installability

## Suggested Future Features

- **Search** — find entries by keyword
- **Mood tags** — tag entries with how you're feeling (😊 😐 😔)
- **Writing streak** — track consecutive days of journaling
- **Dark mode** — easier on the eyes at night
- **Reminders** — daily notification to write
- **Markdown** — bold, lists, and headings in entries
- **Photo attachments** — attach images via Supabase Storage
- **Pin entries** — keep important entries at the top
- **Password / Face ID lock** — extra privacy layer on the PWA
- **Weekly summaries** — auto-generated recap of your week
