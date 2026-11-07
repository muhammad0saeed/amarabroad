# The data robot

Finds universities' programs and keeps them up to date by reading the universities' own web pages every day.
**No AI and no paid service:** plain rules, run on free GitHub servers, saved in Supabase.

```
OpenAlex ─seed-top─► universities ─discover─► program pages ─check (daily)─► programs on the site + page search
                                  │                          │
                 sitemap, or a focused crawl     fetch politely → clean text → changed?
                 that reads each page and keeps            │ yes
                 only pages stating program facts    rules read the facts, each with the sentence it came from
                                                           │
                                       plausible → published      surprising → held for you in /admin
```

## How it runs (non-stop, .github/workflows/robot.yml)

A new shift starts every 6 hours; each job works about 5½ hours, so the robot is practically always working:

- **check**: 6 jobs × 50 websites at once. Asks each site "changed since last time?" (ETag / Last-Modified) and skips unchanged pages without downloading. Hot pages (changed this week, or a deadline within 45 days) every 6 hours, normal pages daily, pages quiet for 90 days every 2 days (`schedule.ts`).
- **discover**: 4 jobs × 40 universities at once. Never-searched universities first, best ranked first; then each university again every 30 days to catch new programs. Failed websites are retried after 3 days.
- **grow**: when fewer than 500 universities wait for a first search, adds the next 500 by rank.
- **Database brake**: above 430 MB (free plan: 500 MB) it only updates known programs and adds nothing new. Only program pages are stored, one latest copy each (`supabase/05_robot_storage.sql`).
- **Private repository**: the plan job switches to a small version that fits GitHub's 2,000 free minutes. Public = full speed.

## Commands

| Command | What it does | Needs |
| --- | --- | --- |
| `npm run robot:peek -- <url>` | Fetch one page politely and print its cleaned text | nothing |
| `npm run robot:try -- <url>` | Read one program page and print what would be published, held, or wasn't found | nothing |
| `npm run robot:discover-try -- <website> [pages]` | Show which program pages discovery finds on a website | nothing |
| `npm run robot:wikidata -- DE 20` | List a country's best-known universities on Wikidata | nothing |
| `npm run robot -- seed-top --total 5000 --floor 50` | Add the top universities of all 30 countries, ranked by OpenAlex research h-index (every country gets at least the floor), with real cities | Supabase |
| `npm run robot -- seed DE --limit 30` | Add a country's universities (and their cities) from Wikidata | Supabase |
| `npm run robot -- discover <university-slug>` | Find that university's program pages and start watching them | Supabase |
| `npm run robot -- discover-all --limit 50 --parallel 10 [--shard 0/4] [--minutes 300]` | The same for universities never searched, then each again every 30 days | Supabase |
| `npm run robot -- grow --step 500 --when-below 500` | Add the next universities by rank when few are left to search | Supabase |
| `npm run robot -- add <url> --university <slug>` | Watch one program page by hand | Supabase |
| `npm run robot -- check --parallel 40 --minutes 300 --shard 0/4` | Visit due pages and update what changed (runs daily as 4 shards side by side) | Supabase |

"Supabase" means `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in `.env.local` (or GitHub secrets for the daily run).

## How it reads a page (rules.ts)

Each rule looks for a keyword and a value next to it, in English, German, Italian and Hungarian (more languages are added in `rules.ts`):

| Fact | Looks for |
| --- | --- |
| Degree level | Master/M.Sc./MBA/Laurea magistrale or Bachelor/B.Sc. in the heading |
| Length | "duration / standard period / Regelstudienzeit" + "4 semesters", "2 years", "18 months" |
| Credits | "120 ECTS", "Credits: 180" |
| Teaching language | "language of instruction / taught in / Unterrichtssprache" + a language |
| Tuition | "tuition / Studiengebühren / tasse" + an amount with currency; per semester → ×2; non-EU amounts first; "no tuition fees" → 0 |
| Other fees | "semester contribution / student fees / Semesterbeitrag" + amount |
| Deadlines and intakes | "deadline / application period / Bewerbungsfrist / scadenza" + dates (31.05., 31 May 2027, May 31, 2027-05-31…), "winter semester" → October start |
| English tests | "IELTS 6.5", "TOEFL iBT 90", "PTE 58", "Duolingo 110" |
| MOI, 3-year degree, provisional | "medium of instruction", "at least 180 ECTS", "apply before receiving your degree" |
| Documents | passport, transcript, CV, motivation letter … in the documents section |
| Subject | title words → the app's subject list |

The lines a fact was found in are saved as its **evidence**, shown on the site with a link to the page.

## How it avoids publishing wrong facts

1. **Evidence check.** The quote must really be on the page and must show the value (`checks.ts → verifyFacts`).
2. **Plausibility.** Surprising changes are held, not published: tuition doubling or halving, tuition-free flips, a changed currency, level or teaching language, MOI / 3-year / provisional rules flipping, past deadlines, out-of-range scores, grades on other scales (`checks.ts → planChanges`).
3. **Nothing is wiped.** If a page stops mentioning something, the old value stays.
4. **Complete or invisible.** The database refuses to publish a program without subject, language, length, tuition, intakes and a check date.
5. **Logged.** `field_changes` keeps every change with old value, new value, evidence and page.
6. **Facts it can't find** are shown as "Not found, check the official page", never guessed.

## Being a good guest on university websites

- Says who it is: `amarAbroadBot/0.1 (+ROBOT_CONTACT_URL)`. Set `ROBOT_CONTACT_URL` to a page explaining the robot, with a way to ask it to stop.
- Obeys robots.txt, including `Crawl-delay`; waits at least 4 seconds between requests to the same site; one request at a time per site.
- Re-reads only pages whose text changed; backs off after errors (1, 2, 4 … up to 14 days); a page that's gone (404) three checks in a row takes its program off the site.
- Copies facts (fees, dates, scores) and short quotes, not whole descriptions. The page search shows short snippets and links to the official page, like a search engine.

## What rules can't do (yet)

- Unusual wording or facts only in images or PDFs are missed, and shown as "Not found". New wording is a new rule in `rules.ts`, with a test in `tests/robot-rules.test.ts`.
- Some universities keep their English programs on a separate site that isn't linked from the homepage; `add` or a different start URL for `discover` covers those.
- Grades on non-4/5 scales (such as the German 1.0-4.0 scale) are held for a person to convert.
- New countries and cities are saved unpublished until their guides (living costs, visa, jobs) are written.
