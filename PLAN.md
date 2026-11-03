# Stage 1 plan (Phase 1)

Proposed structure, components and data files for Stage 1 in `BRIEF.md`. Nothing is installed yet; Phase 2 starts after your OK.

Versions checked on npm (2026-11-04): Next.js 16.4, React 19.3, next-intl 4.14, Tailwind CSS 4.3, Fuse.js 7.5.

## Decisions that differ from the brief or fill a gap

1. **Language in the URL.** A static export cannot run next-intl's middleware, so every page lives under `/en/...` and `/bn/...` (for example `/bn/programs/sample-msc-computer-science`). The bare `/` is a tiny page that sends you to the language saved in localStorage, otherwise the phone's language (Bangla if it is `bn`), otherwise English. The toggle switches between the two copies of the same page. Each language gets real pre-rendered HTML, which is better for SEO than switching text in the browser.
2. **Tailwind 4 keeps its config in CSS.** The design tokens (colors, spacing, radius, type scale, light and dark values) go in one `@theme` block in `app/globals.css`. There is no `tailwind.config.js` in Tailwind 4. That block is the "one Tailwind config" the brief asks for.
3. **Images.** Static export turns off Next's image optimizer, so images are pre-sized WebP files with `loading="lazy"`. Stage 1 uses almost none: country cards and badges are inline SVG.
4. **Field taxonomy.** The Fit Score needs to know what "closely related" means. `data/fields.json` lists each field (CSE, EEE, Civil, BBA, Economics, Pharmacy, …) with an English and Bangla name and a group (Engineering, Business, Life sciences, …). The rules are:
   - Exact field = 15 points.
   - The program lists your field in `related_bachelor_fields` and it is in the same group = 10.
   - It lists your field but the field is in another group = 5.
   - It does not list your field = fails the gate.
5. **Grades on a common scale.** Each program stores `min_gpa_requirement` as `{ value, scale }`, with an optional local-scale note such as "German grade 2.5". The gate and the academics points compare on a 4.0 scale, as the brief's "+0.8 on a 4.0 scale" rule assumes. Bachelor programs use HSC GPA (out of 5). Master's programs use CGPA.
6. **English equivalents.** TOEFL iBT, PTE and Duolingo scores are converted to an IELTS band through one approximate lookup table in the Fit Score config, labelled as approximate in the UI. Only the 0.5-band bonus uses the table. Whether you meet the minimum is checked against the program's own minimum for your test.
7. **"Relevant" extras.** The quiz offers tagged chips: activities, certificates and leadership roles. Each chip is tagged with a field group or "general", plus traits like `leadership` and `research`. A chip counts as relevant if it is general or matches the program's group. The same traits feed the extra weight that merit scholarships give to the items in `evaluates[]`.
8. **Total cost in BDT** = tuition × years + application fee + the city's monthly living cost × `duration_months`. The monthly living cost is shared rent + food + transport + phone + insurance. Program pages also show a first-year figure and the full breakdown. The budget filter uses the total.
9. **Placeholder links.** Every `source_url`, `official_url`, `visa_info_url`, `embassy_url`, ranking URL and job-search link in the sample data points to `https://example.org/sample/...`. Linking to real embassies or job sites would mean guessing real data, which the brief forbids. City and country names are real; universities, programs, scholarships and every number are invented and carry `is_sample: true`. Exchange rates are sample values too.
10. **Async data layer.** `lib/data.ts` exposes async functions (`getProgram(slug)`, `listPrograms()`, …) even though Stage 1 just imports JSON. Stage 2 can then swap in Supabase without touching any page.

## Added from the project brief (approved 2026-11-04)

These come from the wider project brief and all work on sample data with no backend:

- **Degree mapping:** `data/degree-mapping.json` maps BSS, BBA, B.Sc, B.A., honours and pass degrees to the master's fields they qualify for. The match quiz and the eligibility gate use it.
- **More filters:** provisional certificate OK (session jam), open to Bangladeshi citizens, tuition-free, total under X lakh (preset chips like "under 15 lakh"), teaching language and intake month.
- **Grade converter** shows each sample country's system: the German grade, the Italian 110 scale and the Hungarian 5-point scale.
- **"EU-recognised degree"** appears as a quality signal on university pages.
- **Shareable Bangla summary for parents:** a plain-language Bangla card on each program page (cost in lakh, duration, key requirements, deadline) that can be copied or shared.
- **Lite mode:** a toggle that drops images and animations and loads less, for slow data and budget phones. It is remembered in localStorage.
- **Extra guides:** paying application fees from Bangladesh and opening a student file at a bank. They are general and labelled sample, with no real bank rules or fees.
- **Timeline planner** adds passport renewal, IELTS booking and document attestation steps.
- **Report a problem** form: type, description and optional email, with page URL, device and browser attached automatically. On submit it shows "Preview mode: not sent".
- **Coverage count** on Home ("3 countries, 12 universities, 42 programs, all sample") and a placeholder for the Telegram/WhatsApp alerts channel ("coming soon").

Stage 2+ items stay out: admin dashboard, change monitor, unanswered-chat log, Sentry, outcome statistics.

## Folder structure

```
study-abroad/
├─ BRIEF.md, PLAN.md, README.md
├─ next.config.ts           output: 'export', trailingSlash: true (Apache/cPanel friendly), images.unoptimized
├─ app/
│  ├─ globals.css           Tailwind + @theme design tokens, light/dark
│  ├─ fonts/                Inter + Noto Sans Bengali .woff2 (self-hosted via next/font/local)
│  ├─ layout.tsx            root <html>, fonts, no-flash theme script
│  ├─ page.tsx              "/" → language redirect
│  └─ [locale]/
│     ├─ layout.tsx         Header, BottomNav, Footer, intl provider
│     ├─ page.tsx           Home
│     ├─ programs/page.tsx  ·  programs/[slug]/page.tsx
│     ├─ universities/[slug]/page.tsx
│     ├─ cities/[slug]/page.tsx
│     ├─ countries/[slug]/page.tsx
│     ├─ scholarships/page.tsx  ·  scholarships/[slug]/page.tsx
│     ├─ compare/page.tsx   ·  match/page.tsx  ·  profile/page.tsx
│     ├─ tools/page.tsx     ·  saved/page.tsx
│     ├─ guides/page.tsx    ·  guides/[slug]/page.tsx
│     ├─ about/ · disclaimer/ · privacy/ · contact/   (page.tsx each)
│     └─ not-found.tsx
├─ components/              (listed below)
├─ lib/
│  ├─ data.ts               the only module that reads /data
│  ├─ fitScore.ts           gate → score → band → tips; FIT_CONFIG holds every weight
│  ├─ grades.ts             GPA/CGPA scale conversion, German grade (modified Bavarian formula)
│  ├─ cost.ts               total / first-year cost, currency → BDT
│  ├─ money.ts              ৳ lakh/crore formatting, English and Bangla digits
│  ├─ timeline.ts           backward planner from an intake date
│  ├─ chat.ts               question → field answer → Fuse.js over overview → "Not in our data yet"
│  ├─ filters.ts            filter + sort, URL query ⇄ filter state
│  ├─ ics.ts                .ics calendar file builder
│  ├─ storage.ts            typed localStorage: profile, saved, compare tray, language, theme
│  ├─ validation.ts         form validators (no library)
│  └─ guides.ts             loads Markdown guides at build time
├─ types/index.ts           every entity + StudentProfile + FitResult
├─ data/                    (listed below)
├─ content/guides/en/*.md, content/guides/bn/*.md
├─ messages/en.json, messages/bn.json
├─ i18n/routing.ts, i18n/request.ts
├─ tests/                   Vitest unit tests (listed below)
└─ public/                  favicon, icons
```

## Components

| Area | Components |
| --- | --- |
| Layout | `Header`, `LanguageToggle`, `ThemeToggle`, `BottomNav` (Home, Search, Match, Saved, More), `MoreSheet`, `Footer` (short disclaimer + links) |
| UI kit (no UI library) | `Button`, `Card`, `Badge`, `SampleBadge`, `Chip`, `BottomSheet`, `Tabs`, `TextField`, `SelectField`, `CheckboxField`, `Stepper`, `EmptyState`, `Disclosure` |
| Search | `SearchBar`, `QuickFilters`, `FilterPanel` (bottom sheet on mobile, sidebar on desktop), `SortSelect`, `ResultCount`, `ProgramList` |
| Program | `ProgramCard`, `ProgramFacts`, `EligibilityTags` (3-year OK, MOI OK, provisional OK), `SeatsInfo`, `IntakeList`, `CostBreakdown`, `FitScoreCard`, `GateResult`, `ImprovementTips`, `ScoreDisclaimer`, `ProgramChat`, `SaveButton`, `CompareButton`, `ShareButton`, `TrustRow` (last verified, official link, sample badge) |
| Places | `CountryCard`, `CityCostTable`, `WorkRules`, `JobLinks`, `UniversityCard`, `RankingBadge` |
| Scholarships | `ScholarshipCard`, `DeadlineBadge` (days left / closed), `AddToCalendarButton`, `ScholarshipFit` |
| Compare | `CompareTray` (floating, max 4), `CompareTable` |
| Match | `MatchQuiz` with `StepDegree`, `StepEnglish`, `StepBudget`, `StepField`, `StepExperience`; `MatchResults` (ranked, banded, with gate reasons) |
| Profile | `ProfileEditor`, `ProfileExportImport`, `DeleteProfileDialog` |
| Tools | `GradeConverter`, `CostCalculator`, `TimelinePlanner` |
| Forms | `ReportWrongInfoForm`, `ReportProblemForm`, `OutcomeReportForm`, `PreviewModeNotice` |
| Guides | `GlossaryList` (searchable), `GuideArticle`, `SafetyChecklist` |

## Data files

| File | Records | Notes |
| --- | --- | --- |
| `data/countries.json` | 3 | Italy, Germany, Hungary |
| `data/cities.json` | 6 | Milan, Bologna · Berlin, Munich · Budapest, Debrecen |
| `data/universities.json` | 12 | Fictional, e.g. "Sample University of Milan"; mix of public and private |
| `data/programs.json` | about 42 | 3–4 per university, mostly master's with a few bachelor's |
| `data/scholarships.json` | 6 | Linked to a country, a university or a program |
| `data/exchange-rates.json` | 2 | EUR, HUF → BDT (sample rates) |
| `data/glossary.json` | about 25 | English + Bangla explanations (MOI, ECTS, blocked account, …) |
| `data/fields.json` | about 15 | Field taxonomy (decision 4) |

Edge cases planted on purpose, each covered by a test:

- a program that rejects 3-year degrees
- a program that accepts MOI
- a program with `seats_non_eu: null`
- a need-based scholarship
- a program deadline that is already past
- a scholarship deadline that is already past
- a program with a German-scale grade requirement

Bangla content: country and city names and overviews, the glossary and every UI string. University and program names stay in English because they are proper names. A few program overviews get Bangla versions, and the rest show the English fallback.

## Tests (Vitest)

`fitScore` (gate reasons, every scoring part, bands, tips, scholarship weighting, every seed edge case) · `grades` · `cost` · `money` (lakh/crore, Bangla digits) · `timeline` · `chat` · `filters` (country + budget + 3-year + MOI, URL round-trip) · `ics` (valid file) · `data` (every reference resolves, every record has `is_sample: true`, edge cases exist).

## Needs your OK: dependencies not named in the brief

| Package | Why | Ships to the browser? |
| --- | --- | --- |
| `vitest` | Unit tests the brief requires; it names no runner | No (dev only) |
| `marked` | Turns guide Markdown into HTML at build time | No (build time only) |
| `@fontsource-variable/inter`, `@fontsource-variable/noto-sans-bengali` | One-time source of the `.woff2` files copied into `app/fonts/`; removed after copying | Only the font files, from your own domain |

`create-next-app` also adds its usual ESLint and `@types/*` dev packages. Dark mode, the bottom sheet, form validation and the `.ics` builder are written by hand, with no extra packages. In Phase 7, Lighthouse runs through `npx lighthouse` and is not added to the project.

Approved by Said on 2026-11-04.

## Settled

- **Working name:** amarAbroad, kept in one config value (`lib/site.ts`).
- **Default language:** English unless the phone is set to Bangla.
- **Fonts:** Inter + Noto Sans Bengali, self-hosted.
- **Primary color:** indigo blue, set once in the `@theme` design tokens.
- **Check-ins:** stop after every one of the 7 phases for Said's OK.
- **Phone testing:** the dev server is reachable from Said's phone on the same Wi-Fi, at the PC's local address. Nothing is put online.
- **Git:** a commit at the end of each phase Said approves.

## Design direction (from `design/references/`, settled 2026-11-04)

The look comes from the five reference shots, kept light enough for a budget Android phone on slow data.

| Element | Direction | Reference |
| --- | --- | --- |
| Canvas | Soft grey background (dark mode: near-black) with white rounded cards and very soft shadows; no glass blur | 1, 2, 3, 5 |
| Primary color | Indigo blue for main buttons, active chips, progress bars, the active nav tab and links; everything else is neutral grey | 2, 4, 5 |
| Buttons | Main action = full-width indigo pill with an arrow; secondary = white or grey pill with an outline | 4, 5 |
| Type | Big, bold, tight headings ("Find your program abroad"), small grey supporting text, Inter + Noto Sans Bengali | 1, 3, 4 |
| Cards | Large radius (about 24px for cards, 16px for inner tiles, full pill for chips and buttons); one featured card on Home in indigo with white text | 2, 3 |
| Icons | Simple line icons (SVG, drawn in-house) inside pastel rounded tiles, one pastel per field or category (CSE, Business, Life sciences, …) | 3, 5 |
| Countries | A color-wash card per country with its name and key facts, no photos | 4 (layout only) |
| Chip rows | Scrollable rows of pill chips for quick filters and chat questions; date-strip chips for intakes and deadlines | 1, 2 |
| Bottom nav | Floating white pill bar with 5 icons; the active tab gets an indigo pill and its label | 1, 4 |
| Lists | Rounded list rows with an icon tile on the left, title + meta in the middle and a chevron or badge on the right | 3 |
| Progress | Stepper dots and a thin indigo bar for the 5-step Match quiz; a ring or bar for the Fit Score | 3, 5 |
| Imagery | None in Stage 1: no photos, no 3D renders, no avatars. Real illustrations can come with the Figma designs | — |

Nothing is copied from the references: no names, text or artwork. They only set the visual direction.
