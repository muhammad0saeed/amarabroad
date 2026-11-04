# amarAbroad (working name)

A Bangladesh-first study-abroad finder: countries, cities, universities, programs and scholarships, with eligibility checks, a transparent Fit Score and costs in taka. Stage 1 is a private web preview on **sample data**: every university, program, number and date is invented.

- Spec: [BRIEF.md](BRIEF.md) · Plan and decisions: [PLAN.md](PLAN.md) · Stage 1 check: [CHECKLIST.md](CHECKLIST.md)
- Next.js 16 static export, TypeScript, Tailwind CSS 4, next-intl (English + Bangla), Fuse.js. No server, database, login, cookies or analytics.

## Run it

Needs Node.js 20 or newer (built with Node 24).

```bash
npm install
npm run dev
```

Open http://localhost:3000. It forwards to `/en/` or `/bn/` (the saved language, else the phone's language, else English).

### On your phone (same Wi-Fi)

```bash
npm run dev:phone
```

Find your PC's local address (run `ipconfig` and look for the IPv4 address, e.g. `192.168.0.105`), then open `http://192.168.0.105:3000` on the phone.

If the phone can't connect, Windows Firewall is blocking it:

1. In **Settings → Network & internet → Wi-Fi → your network**, set the network profile to **Private** (right for home Wi-Fi).
2. When Windows asks whether Node.js may use the network, allow it on **private** networks only.

## Check it

```bash
npm test          # unit tests: Fit Score, costs, grades, chat, filters, data rules, forms
npm run typecheck # TypeScript
npm run lint      # ESLint
npm run build     # static site in /out
```

`npm run build` also runs `scripts/fix-export-segments.mjs`, which works around a Next.js bug on Windows (prefetch files written to the wrong place). It does nothing on macOS/Linux.

## Deploy to a password-protected Hostever subdomain

The site is plain files in `/out`; any Apache host works. Steps for Hostever's cPanel:

1. **Build:** `npm run build`. Everything to upload is now in `out/`, including an `.htaccess` (compression, caching, 404 page, https).
2. **Create the subdomain:** cPanel → **Domains** (or **Subdomains**) → e.g. `preview.yourdomain.com`. Note its document root, e.g. `public_html/preview`.
3. **Turn on SSL:** cPanel → **SSL/TLS Status** → run **AutoSSL** for the subdomain (the `.htaccess` redirects to https).
4. **Upload:** zip the *contents* of `out/` (not the folder itself), then cPanel → **File Manager** → open the document root → **Upload** the zip → right-click → **Extract**. Delete the zip afterwards. Turn on **Show Hidden Files** in File Manager settings to see `.htaccess`.
5. **Password-protect it:** cPanel → **Directory Privacy** → choose the document root → tick **Password protect this directory** → name it → **Save** → create a user and password. Share those only with people testing the preview.
6. **Check:** open `https://preview.yourdomain.com` — it should ask for the password, then forward to `/en/`.

**Updating later:** build again and upload the new `out/` contents over the old ones, but **don't overwrite `.htaccess`** — Directory Privacy added its password lines to it. (If you do overwrite it, just tick Password protect again in Directory Privacy.) Deleting old files first is fine; file names under `_next/static/` change with every build.

The site is marked `noindex` everywhere, so search engines skip it even without the password.

## Change or add data

All data lives in JSON files in `data/`, read only by `lib/data.ts` (Stage 2 will swap this for Supabase without touching the pages).

| File | What it holds |
| --- | --- |
| `countries.json` | Country guides: education system, work rules, visa basics |
| `cities.json` | Monthly costs (local currency), jobs, community notes |
| `universities.json` | Type, accreditation, ranking with source |
| `programs.json` | Requirements, fees, intakes and deadlines, seats, English tests |
| `scholarships.json` | Type, coverage, deadline, where it applies |
| `exchange-rates.json` | Taka per euro and per forint |
| `glossary.json` | Bangla/English glossary |
| `fields.json` | Study fields and their groups (used by the Fit Score) |
| `degree-mapping.json` | Bangladeshi degrees and the field each maps to |

To add a program, copy an existing entry in `programs.json` and change it:

- `slug` must be unique and URL-safe (`lowercase-with-dashes`); it becomes the page address.
- `university` is a slug from `universities.json`; `field` and `related_bachelor_fields` are slugs from `fields.json`.
- Amounts are in the program's `currency`; city costs are monthly, in the country's currency.
- Every record keeps `source_url`, `last_verified` (`YYYY-MM-DD`) and `is_sample`. Real data in Stage 2 sets `is_sample` to `false` and links to the official page.
- Text fields ending in `_en` / `_bn` are shown by language; a missing `_bn` falls back to English.

Then run `npm test`: `tests/data.test.ts` checks counts, links between files, grade scales, deadlines and the sample-data rules, and fails with the record that's wrong. (Those tests describe the *sample* set; when real data arrives, update the count checks in that file.)

## Change UI text

Every string on screen is in `messages/en.json` and `messages/bn.json`, with the same keys. `npm test` fails if a key exists in one file only, or if placeholders like `{count}` differ. In Bangla, write numbers you pass in as `{count, number}` so they show Bangla digits.

Guides are Markdown files in `content/guides/en/` and `content/guides/bn/` (same file name in both). A Bangla guide that doesn't exist yet shows the English one.

## Project layout

| Folder | What's in it |
| --- | --- |
| `app/[locale]/` | Pages (`/en/...`, `/bn/...`); each section's `layout.tsx` lists the UI text its browser code needs |
| `app/globals.css` | Design tokens: colours (light/dark), radius, type scale |
| `app/fonts/` | Self-hosted Inter and Noto Sans Bengali (SIL Open Font License) |
| `components/` | UI pieces |
| `lib/` | Logic: `fitScore.ts`, `cost.ts`, `grades.ts`, `timeline.ts`, `chat.ts`, `filters.ts`, `data.ts`, … |
| `data/`, `content/`, `messages/` | Sample data, guides, UI text |
| `tests/` | Unit tests |
| `design/references/` | Visual references |

## Notes

- **Fit Score weights** are all in `FIT_CONFIG` in `lib/fitScore.ts`.
- **Budget chips** (under 30/40/60 lakh) are `BUDGET_PRESETS_LAKH` in `lib/filters.ts`.
- **Working name** is set once in `lib/site.ts`.
- Next.js sends anonymous build statistics from your PC; run `npx next telemetry disable` once to turn that off. It doesn't affect visitors.
