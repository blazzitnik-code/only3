# Only3

> Three tasks a day. That's it.

Mobile-first PWA built with Next.js 15 App Router, Supabase, and Vercel.

---

## Stack

- **Next.js 15** (App Router, TypeScript)
- **Supabase** — Auth (Google OAuth) + Postgres
- **Vercel** — Hosting + Cron jobs
- **Web Push API** — Daily notifications via VAPID

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/only3.git
cd only3
npm install
```

### 2. Supabase

1. Create a new Supabase project
2. Go to **SQL Editor** → paste and run `supabase-schema.sql`
3. Go to **Authentication → Providers → Google** → enable and add your Google OAuth credentials
4. In **Authentication → URL Configuration**, add:
   - Site URL: `https://your-vercel-domain.vercel.app`
   - Redirect URL: `https://your-vercel-domain.vercel.app/auth/callback`

### 3. Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials (Web application)
3. Add authorized redirect URI: `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`
4. Paste Client ID + Secret into Supabase Google provider settings

### 4. VAPID keys (Web Push)

```bash
npx web-push generate-vapid-keys
```

Copy the output into your env vars.

### 5. Environment variables

Copy `.env.local.example` to `.env.local` and fill in all values:

```bash
cp .env.local.example .env.local
```

### 6. Run locally

```bash
npm run dev
```

### 7. Deploy to Vercel

```bash
vercel --prod
```

Add all env vars in Vercel dashboard under **Settings → Environment Variables**.

The cron job (`vercel.json`) runs every minute and sends push notifications to users whose `notification_time` matches the current UTC time.

---

## PWA install

On mobile:
- **iOS Safari**: Share → Add to Home Screen
- **Android Chrome**: Menu → Add to Home Screen (or install banner)

---

## Features

- ✅ 3 tasks per day
- 🔥 Streak tracking
- 📅 Monthly calendar heatmap
- 🏆 Milestones
- 😄 Daily mood log
- 🎯 Weekly intention
- 🔔 Daily push notification (user-set time)
- 🎉 Confetti + sound on completion
- 🌙 Dark mode only (by design)
