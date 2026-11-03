# Study Abroad App — Claude Code Build Brief

Nov 4, 2026 · Said

This brief tells Claude Code exactly what to build for Stage 1: a private web preview of a Bangladesh-first university, program and scholarship finder, running on sample data. Save it as `BRIEF.md` in the project folder and paste the prompt at the end.

## Tech stack

Use **Next.js (React) + TypeScript + Tailwind CSS**, built as a static site for Stage 1 and wrapped into an Android app later. One codebase covers the website, the installable web app (PWA) and the Android APK.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js (App Router), TypeScript | Fast pages, good SEO for program pages, huge ecosystem Claude Code knows well |
| Styling | Tailwind CSS | Quick to match Figma designs, small CSS output |
| Stage 1 data | JSON files in `/data` | No server or database needed to preview |
| Stage 1 hosting | Static export (`output: 'export'`) on a password-protected Hostever subdomain, or `npm run dev` locally | Stays private, costs nothing extra |
| Search and chat | Fuse.js (fuzzy search in the browser) | Works offline, no AI API keys |
| Languages | next-intl (Bangla + English) | Language toggle on every page |
| Saved items | Browser localStorage | No login needed |
| Stage 2 backend | Supabase (Postgres, free tier) or PHP + MySQL on Hostever | Admin dashboard, reports, real data |
| Mobile app | PWA first, then Capacitor for an Android APK | Reuses the same code; APK can be shared free without a store |

Avoid a separate native app (Flutter, Kotlin) for now. It would mean building everything twice.

## Build stages

Stage 1 is a clickable, private web preview on sample data. Each later stage adds one layer on top without rewriting it.

1. **Stage 1 — Web preview (this brief).** All student-facing pages, filters, compare, match quiz with Fit Score, tools, local chat, saved list, Bangla/English. Data from JSON. Forms show a "preview only" message instead of sending.
2. **Stage 2 — Backend and admin.** Move data to Supabase, build the admin dashboard (content manager, verification dates, error reports inbox, outcome-report moderation), Telegram notifications, Cloudflare Turnstile on forms.
3. **Stage 3 — Live data tools.** Page-change monitor for official sources (small VPS + cron), deadline calendar, outcome statistics shown once a program has 5+ approved reports, cookieless analytics (Umami).
4. **Stage 4 — Mobile app.** PWA install prompt, offline saved programs, then a Capacitor Android APK.

Stages 2–4 are listed for context only. Claude Code should build Stage 1 now but keep the data layer behind one module (`lib/data.ts`) so Stage 2 can swap JSON for Supabase.

## Stage 1 scope: pages and features

Stage 1 has 14 page types. Every page works on a 360px-wide phone first, then scales up to desktop.

| Route | Page | Must include |
| --- | --- | --- |
| `/` | Home | Search bar, quick filters (country, degree level, budget in BDT, field), scholarships closing soon, country cards, "Match me" call to action |
| `/programs` | Search results | Filter panel (bottom sheet on mobile), sort, program cards with key facts and BD eligibility tags, result count, clear-all |
| `/programs/[slug]` | Program page | Overview, requirements, BD eligibility tags, seats (or "Not published"), intakes and deadlines, total cost in BDT, scholarships, Fit Score if profile saved, last-verified date, official link, chat, save, compare, share, report wrong info, share your result |
| `/universities/[slug]` | University page | About, public/private, accreditation, ECTS, ranking with source link, city link, list of programs |
| `/cities/[slug]` | City guide | Overview, monthly cost breakdown in BDT, student work rules, minimum wage, common student jobs, local language note, BD community note, "Search current jobs" outbound links, universities in the city |
| `/countries/[slug]` | Country guide | Overview, education system, post-study work rights, general visa info with embassy link, cities, scholarships |
| `/scholarships` and `/scholarships/[slug]` | Scholarships | BD-eligible filter, type (merit/need/mixed), coverage, deadline with days left, add-to-calendar (.ics), official link |
| `/compare` | Compare | 2–4 programs side by side, shareable via URL query, e.g. `?ids=a,b,c` |
| `/match` | Match me | 5-step quiz: degree and grades, English test, budget, field and goals, experience and extracurriculars. Returns ranked programs with Fit Score bands and reasons |
| `/profile` | My profile | Edit saved profile, export/import as JSON file, delete profile |
| `/tools` | Tools | Grade converter (SSC/HSC GPA out of 5, CGPA out of 4), BDT cost calculator, backward timeline planner from intake date |
| `/saved` | Saved | Saved programs and comparisons from localStorage |
| `/guides` | Guides | Bangla glossary, agency safety checklist, short how-to articles (Markdown files) |
| `/about`, `/disclaimer`, `/privacy`, `/contact` | Info pages | Disclaimer and privacy text, report-a-problem form |

**Global features**

- Bangla/English toggle in the header, remembered in localStorage.
- Program chat: suggested question chips plus free text. Answers come only from that program's data (field match first, then Fuse.js search over its overview). If nothing matches, show "Not in our data yet", the official link, and a "Copy question with program details" button for use in ChatGPT or Gemini, with a note that other AIs can be wrong.
- Report forms (wrong info, problem, outcome report): full UI and validation, but on submit show "Preview mode: not sent". Stage 2 connects them.
- Every card and page shows a "Sample data" badge while data is sample.

## Data model

Data follows one chain: Country → City → University → Program, with Scholarships linked to countries, universities or programs. Each entity is one JSON file in `/data`, typed in `types/index.ts`. Every record carries `source_url`, `last_verified` (date) and `is_sample` (true in Stage 1).

| Entity | Key fields | Links to |
| --- | --- | --- |
| Country | slug, name_en, name_bn, currency, overview, education_system, post_study_work, student_work_hours, min_wage, visa_info_url, embassy_url | Cities, Scholarships |
| City | slug, name_en, name_bn, country, overview, population_students, cost_rent_shared, cost_rent_studio, cost_food, cost_transport, cost_phone, cost_insurance (local currency, monthly), local_language_needed_for_jobs, common_student_jobs[], bd_community_note, job_search_links[] | Country, Universities |
| University | slug, name, city, type (public/private), accreditation, ects (bool), ranking {source, rank, year, url}, website, overview | City, Programs |
| Program | slug, title, university, degree_level, field, language, duration_months, ects_credits, tuition_per_year, application_fee, intakes[{month, deadline}], seats_non_eu (number or null), min_gpa_requirement, accepts_3yr_bachelor, accepts_moi, accepts_provisional, english_tests[{test, min_score}], required_documents[], related_bachelor_fields[], overview, career_paths, official_url | University, Scholarships |
| Scholarship | slug, name, provider, type (merit/need/mixed), bd_eligible, levels[], coverage, deadline, eligibility_summary, evaluates[] (e.g. leadership, research), official_url | Countries, Universities, Programs |
| ExchangeRate | currency, bdt_per_unit, updated_on | Used by all BDT conversions |
| GlossaryTerm | term, explain_en, explain_bn | Guides |

Student profile (stored in localStorage only): degree_type, degree_years (3 or 4), university_type (public/private/NU), cgpa, cgpa_scale, ssc_gpa, hsc_gpa, field, english_test, english_score, has_moi, budget_bdt_total, target_countries[], experience_months, research (bool), extracurriculars[], certificates[], skills[].

## Fit Score and match logic

The Fit Score (0–100) measures how well a profile matches a program's published requirements. It is never shown as a chance of admission. Put all logic in `lib/fitScore.ts` with unit tests, and keep weights in one config object so they can be tuned later.

**Step 1 — Eligibility gate (pass/fail).** Fail if any of these is true, and show "Not eligible" with the reason, no score:

- 3-year bachelor and `accepts_3yr_bachelor` is false
- Field not in `related_bachelor_fields`
- No English score meeting the minimum and not (`has_moi` and `accepts_moi`)
- CGPA below the minimum after converting to the program's scale

**Step 2 — Score.**

| Part | Max points | Rule |
| --- | --- | --- |
| Academics | 40 | 20 for meeting the minimum, plus up to 20 scaled by how far above the minimum the CGPA is (full at +0.8 on a 4.0 scale) |
| English | 20 | 12 for meeting the minimum, plus 4 for each 0.5 IELTS band (or equivalent) above it, max 8; MOI-only counts as 12 |
| Field relevance | 15 | 15 exact field, 10 closely related, 5 loosely related |
| Experience | 15 | Work or internships 1 point per 2 months (max 10), research +5 |
| Extras | 10 | 2 per relevant extracurricular, certificate or leadership role (max 10) |

**Bands:** 80+ Strong, 60–79 Good, 40–59 Possible, below 40 Weak.

**Step 3 — Improvement tips.** Recalculate with one change at a time (English +0.5 band, one extra certificate, 6 more months of experience) and show the top three gains, e.g. "IELTS 6.5 → 7.0: +4 points".

**Scholarships.** Merit-based ones use the same score, with extra weight on the items in `evaluates[]`. Need-based ones show "Based on family income, not scored here".

**Disclaimer under every score:** "This score shows how your profile matches the published requirements. It is not a chance of admission or scholarship. Universities also consider motivation letters, interviews and the number of applicants. Always check the official program page."

## Design, language and performance

The app must feel fast and clear on a budget Android phone on slow mobile data.

**Design**

- Mobile-first, 360px base width, no horizontal scroll; bottom navigation on mobile (Home, Search, Match, Saved, More).
- Clean, calm, trustworthy look: one primary color, neutral greys, generous spacing, rounded cards. Design tokens (colors, spacing, radius, type scale) in one Tailwind config so Figma designs can be matched later.
- Light and dark mode.
- Clear trust signals on every program: last-verified date, official link, "Sample data" badge in Stage 1.
- Accessible: 4.5:1 text contrast, visible focus states, labels on all form fields, tap targets at least 44px.

**Language**

- All UI text in `messages/en.json` and `messages/bn.json`; no hard-coded strings.
- Content fields have `_en` and `_bn` versions where it matters (names, overviews, glossary); fall back to English when Bangla is missing.
- Money shown in BDT first ("৳ 12.5 lakh"), local currency second. Format lakh/crore correctly.

**Performance**

- Lighthouse mobile score 90+ for performance and accessibility.
- Fonts self-hosted with `next/font/local`: one Latin font plus Noto Sans Bengali or Hind Siliguri. No Google Fonts CDN.
- No heavy UI libraries; images optimized and lazy-loaded; search index loaded only on search pages.

## Seed data, privacy and legal

Stage 1 runs on clearly fake sample data, so nothing in the preview can mislead anyone.

**Seed data rules**

- Create 3 countries (Italy, Germany, Hungary), 2 cities each, 2 universities per city, 3–4 programs per university, and 6 scholarships.
- University and program names are fictional (e.g. "Sample University of Milan"); every number is plausible but invented; every record has `is_sample: true`.
- Never present invented requirements, deadlines or seat counts as real. Claude Code must not "look up" or guess real data.
- Cover edge cases on purpose: a program that rejects 3-year degrees, one accepting MOI, one with `seats_non_eu: null`, a need-based scholarship, a past deadline.

**Privacy**

- No login, no cookies, no analytics, no tracking pixels, no session replay in Stage 1. That means no consent banner is needed.
- The profile stays in the browser only; the profile page explains this and offers export and delete.
- `/privacy` page explains what is stored locally and that nothing is sent in Stage 1.

**Legal pages and notices**

- `/disclaimer`: guidance only; no admission, scholarship or visa guarantee; always confirm with the official university page and embassy.
- Footer on every page: short disclaimer and links to Disclaimer and Privacy.
- Rankings show rank, year and a link to the source, never a copied full ranking table.
- Job search buttons only link out to job sites; no scraping.
- Later stages: when students can upload proof screenshots (Stage 2), add a privacy notice, auto-delete after review, and register a DMCA agent if the app serves US users. If a paid tier is ever added, put renewal terms right next to the pay button. Use cookieless analytics only (Umami or Plausible).

## Stage 1 acceptance checklist

Stage 1 is done when every box below is ticked on a real phone and on desktop.

- [ ] `npm run dev` runs with no errors; `npm run build` produces a static export in `/out`
- [ ] All 14 page types render with sample data and link to each other correctly
- [ ] Filters combine correctly (country + budget + accepts 3-year + MOI) and the URL keeps filter state
- [ ] Compare works for 2–4 programs and the share link reopens the same comparison
- [ ] Match quiz saves the profile, returns ranked programs, and shows gate reasons for ineligible ones
- [ ] Fit Score unit tests pass, including every edge case in the seed data
- [ ] Improvement tips show correct point gains
- [ ] Chat answers field questions, falls back to search, then shows the copy-to-other-AI fallback
- [ ] Grade converter, BDT cost calculator and timeline planner give correct results
- [ ] Saved list and profile survive a page reload; export and import of profile work
- [ ] Bangla/English toggle switches every UI string; lakh formatting is correct
- [ ] Add-to-calendar downloads a valid .ics file
- [ ] All forms validate and show "Preview mode: not sent"
- [ ] "Sample data" badge visible everywhere; footer disclaimer on every page
- [ ] Fonts load from the project, not a CDN; no third-party requests in the network tab
- [ ] Lighthouse mobile 90+ for performance and accessibility on Home, Search and Program pages
- [ ] `README.md` explains how to run, build, deploy to a Hostever subdomain, and add data

## Prompt for Claude Code

Export this doc as Markdown, save it as `BRIEF.md` in an empty project folder, then paste the prompt below into Claude Code.

```text
Read BRIEF.md fully before doing anything. It is the spec for Stage 1 of a
Bangladesh-first study-abroad guidance web app. Build Stage 1 only.

Work in this order and stop after each phase to show me what is done:
1. Plan: propose the folder structure, list of components, and data files.
   Wait for my OK.
2. Setup: Next.js (App Router) + TypeScript + Tailwind + next-intl,
   static export, self-hosted fonts (Latin + Noto Sans Bengali).
3. Data: types in types/index.ts, sample JSON in /data following the seed
   data rules exactly (fictional names, is_sample: true, all edge cases).
   All data access goes through lib/data.ts.
4. Core logic: lib/fitScore.ts with unit tests, grade converter, BDT cost
   calculator, timeline planner, chat answer logic (no AI APIs).
5. Pages: Home, Search, Program, University, City, Country, Scholarships,
   Compare, Match, Profile, Tools, Saved, Guides, Info pages.
6. Polish: Bangla strings, dark mode, mobile layout at 360px, accessibility,
   Lighthouse 90+.
7. Check: go through the Stage 1 acceptance checklist in BRIEF.md and
   report each item as pass or fail.

Rules:
- Never invent or look up real university data; use only sample data.
- No analytics, cookies, tracking, external fonts or external API calls.
- Keep the app private: no deployment unless I ask.
- Ask me before adding any dependency not listed in BRIEF.md.
- Write a README with run, build and Hostever deployment steps.
```
