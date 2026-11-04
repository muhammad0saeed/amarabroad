# Stage 2 plan: backend and admin

Stage 2 from [BRIEF.md](BRIEF.md): move data to Supabase, build the admin dashboard (content manager, verification dates, error-reports inbox, outcome-report moderation), Telegram notifications and Cloudflare Turnstile on forms. Settled with Said on 2026-11-05: all of Stage 2, one phase at a time with his OK after each; hosting on **Vercel**; admin sign-in by **email magic link**; database changes as **SQL files Said pastes into the Supabase SQL Editor**.

## How it fits together

```
Visitor's phone ──► Vercel (Next.js)
                     ├─ public pages: pre-rendered, refreshed when the admin saves a change
                     ├─ form submissions ──► check Turnstile ──► save in Supabase ──► Telegram message to Said
                     └─ /admin (magic-link login, only Said's email) ──► read/edit Supabase
Supabase: Postgres tables + row-level security (RLS) + Auth (magic link)
```

Key choices:

1. **Visitors never talk to Supabase directly.** Public pages are rendered on Vercel from Supabase data and cached, so a visitor's browser still makes no third-party requests (the Turnstile check on forms is the one exception, and it only loads when a form is opened). Pages stay as fast as Stage 1.
2. **Edits show up quickly without rebuilding.** When the admin saves a program, the affected pages are refreshed on Vercel within seconds (on-demand revalidation).
3. **Secrets stay on the server.** The Supabase secret key, Turnstile secret and Telegram bot token live only in Vercel's environment settings and your local `.env.local`, never in the browser or in git.
4. **Row-level security on every table.** Anyone may *read* published content; nobody can write except through the server (forms) or a signed-in admin. Reports are readable only by admins.
5. **Cookies only for the admin.** Signing in to `/admin` sets Supabase's login cookie. Public pages stay cookie-free, so no consent banner is needed (a login cookie counts as strictly necessary).
6. **The JSON sample data becomes the seed.** I generate SQL inserts from the current `data/*.json`, so Supabase starts with exactly what Stage 1 shows. The data tests keep checking the seed.
7. **Admin is English-only** (it's your tool); public pages stay English + Bangla.

## Phases (stop after each for your OK)

| # | Phase | What you'll see at the end |
| --- | --- | --- |
| 2.1 | **Server mode and Supabase connection** — drop the static export, add `proxy.ts` for `/en` · `/bn` routing, Supabase clients, `.env.local` template | The app runs exactly as before with `npm run dev`, now as a server app that can reach Supabase |
| 2.2 | **Database tables and seed** — SQL for content tables, report tables, admin list, RLS policies; seed generated from the JSON | You paste 3 SQL files into Supabase; tables fill with the sample data |
| 2.3 | **Read data from Supabase** — `lib/data.ts` switches from JSON to Supabase (server-side, cached); JSON kept only as the seed | Same pages, now served from the database |
| 2.4 | **Forms that send** — server actions for wrong-info, problem and outcome reports; Turnstile check; simple rate limit; Telegram message to you | Submitting a form on the site pings your Telegram and appears in the database |
| 2.5 | **Admin: sign-in, overview and inboxes** — magic link, overview (counts, records not verified in 60+ days, new reports), reports inbox (New / Working / Fixed), outcome moderation (approve / reject) | You sign in at `/admin` and work through reports |
| 2.6 | **Admin: content manager** — edit programs, universities, cities, countries, scholarships, exchange rates; "mark verified today"; pages refresh after saving | You change a deadline in `/admin` and see it live |
| 2.7 | **Deploy to Vercel and check** — connect the project, set environment variables, private access, run the Stage 2 checklist | A private Vercel address that works on your phone |

Not in Stage 2 (Stage 3, per the brief): page-change monitor, deadline calendar, outcome statistics, analytics, bulk CSV import, chat log of unanswered questions.

## Database tables (phase 2.2)

| Table | Holds | Who can read / write |
| --- | --- | --- |
| `countries`, `cities`, `universities`, `programs`, `scholarships`, `exchange_rates`, `glossary_terms`, `fields`, `degree_mappings` | Same fields as today's JSON (nested parts like intakes and English tests as JSON columns), plus `published`, `updated_at` | Everyone reads published rows; admins write |
| `wrong_info_reports` | Program, topic, correction, source link, optional email, status | Server inserts; admins read and update |
| `problem_reports` | Type, description, page, device, app version, optional email, status | Server inserts; admins read and update |
| `outcome_reports` | Program, intake, result, CGPA, degree, university type, English score, experience, tips, status (pending / approved / rejected) | Server inserts; admins read and moderate |
| `admins` | Email addresses allowed into `/admin` (just yours) | Admins read; changed only in the SQL Editor |

## Packages to approve (not named in the brief)

| Package | Why |
| --- | --- |
| `@supabase/supabase-js` (2.119) | Talk to Supabase from the server |
| `@supabase/ssr` (0.12) | Keep the admin's login session in a cookie on Vercel |

No package is needed for Turnstile (a script tag) or Telegram (one HTTPS call).

## What you'll need to prepare (I'll tell you exactly when)

| For phase | What | Where it goes |
| --- | --- | --- |
| 2.1 | Supabase **Project URL** and **publishable key** (Project Settings → API keys). These two are safe to paste in chat. | `.env.local` |
| 2.1 | Supabase **secret key**. **Don't paste it in chat**; you paste it into `.env.local` yourself. | `.env.local`, later Vercel |
| 2.4 | A **Telegram bot** (from @BotFather) and your chat ID. The bot token is a secret: you put it in `.env.local` yourself. | `.env.local`, later Vercel |
| 2.4 | A free **Cloudflare Turnstile** widget for your future domain. The site key is public; the secret key goes in `.env.local` yourself. | `.env.local`, later Vercel |
| 2.5 | In Supabase **Authentication → URL configuration**, the site URL and redirect URLs I'll give you; your email added to `admins` by SQL | Supabase dashboard |
| 2.7 | A free **Vercel** account connected to GitHub (the code needs to be in a private GitHub repo), or the Vercel CLI | Vercel |

## Things to know

- **Free Supabase projects pause after a week without traffic.** Fine for a preview; open the dashboard to wake it. A paid plan avoids it.
- **Private access on Vercel:** the free plan's "Vercel Authentication" means only people signed in to your Vercel team can open preview deployments. A shareable password needs Vercel Pro. I'll set up whichever you prefer in 2.7.
- **The Android APK (Stage 4)** will load the Vercel site inside the app instead of bundling static files. Still one codebase.
- **Hostever** isn't needed for Stage 2. The domain can still point to Vercel later.
