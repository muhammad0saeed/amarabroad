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
| `npm run robot -- official <au\|us\|uk> [--file F] [--dry] [--all] [--university slug]` | Programs from an official government course list, for universities whose websites block the robot (see below). `--dry` only shows the matches | Supabase |

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

## Universities that block the robot: official course lists (official-data.ts)

Some big universities (Oxford, UCL, Melbourne, Monash, Johns Hopkins…) refuse robots (HTTP 403). The robot never pretends to be a browser to get around that. For these it uses the course lists governments publish for free reuse:

| Country | Dataset | Licence | What it gives | Download |
| --- | --- | --- | --- | --- |
| Australia | [CRICOS register](https://data.gov.au/data/dataset/cricos), Department of Education | CC BY 2.5 AU | every course for student-visa holders: name, level, weeks, language, whole-course tuition | automatic, monthly updates |
| US | [College Scorecard](https://collegescorecard.ed.gov/data/), Department of Education | US government data, public domain | each university's subjects with bachelor's/master's graduates (CIP codes), out-of-state tuition | automatic, no key needed |
| UK | [Discover Uni dataset](https://www.hesa.ac.uk/data-and-analysis/discover-uni-dataset), HESA / Office for Students | CC BY 4.0 | every course with the university's own course page | **by hand** (see below) |
| Canada | none: there is no national list of university programs (only provincial statistics) | | | |

How it works:

1. **Match** each dataset provider to our universities by name or by the main part of the website (`www.monash.edu.au` = `monash.edu`). One provider goes to one university; unclear matches are left out and listed.
2. **Pick the blocked ones**: universities whose search failed, or whose program pages mostly refuse to load, and that have no program read from their own pages. (`--all` takes every matched university, `--university` one.)
3. **Save programs** through the same checks as page reading (`planChanges`, `applyProgram`). Each value's evidence is the dataset's own row (`CRICOS course 001447E "Bachelor of Economics": Duration 156 weeks`) linking to the dataset page, so the site shows "data.gov.au" or "collegescorecard.ed.gov" as the source. "Apply" goes to the university's course page (UK) or website (AU, US).
4. **UK course pages** are also added as `program_page` sources: the daily check reads them when the website allows, and adds what the page says (fees, deadlines) to the same program.
5. A program the robot already read from the university's own page always wins; the importer never overwrites it. Re-runs update earlier imports (surprising changes are held for you, as usual).
6. When the robot later reads a course page whose title matches an imported program at the same university, it adds the page's facts to that program instead of making a second one (`datasetTwin` in `db.ts`).

Weekly: the `official` job in `.github/workflows/robot.yml` runs every Monday (03:30 Bangladesh time): **Australia for every matched university** (`--all`, about 8,000 programs), **the US for blocked universities only**. All ~820 matched US universities would be about 80,000 programs (≈600 MB), more than the free database (500 MB) holds; with Supabase Pro, add `--all` to the US line too.

**UK, by hand (once a year is enough; courses change yearly):** HESA's download page has an "are you a robot?" check, which the robot must not get around. Open the link above in your browser, download the latest zip, then run
`npm run robot -- official uk --file "C:\path\to\the.zip"` (a folder with the unzipped CSV files works too).

Limits: CRICOS fees are the whole-course fee registered with the government, divided by the years; universities' current fees can be a little different. Scorecard programs are subject areas ("Computer Science – Bachelor's degree"), not each course's exact name, and have no length. Datasets have no deadlines or English test scores; those show "Not found, check the official page". Programs without a clear subject stay hidden, as always.

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
