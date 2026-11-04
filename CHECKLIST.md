# Stage 1 acceptance checklist

Checked on 2026-11-05 against the list in [BRIEF.md](BRIEF.md). "Desktop" means Chrome on Windows; phone checks were done in Chrome's phone emulation at 360–375 px. **A real-phone check is still to do** (see the end).

| # | Item | Result | How it was checked |
| --- | --- | --- | --- |
| 1 | `npm run dev` runs with no errors; `npm run build` makes a static export in `/out` | **Pass** | Dev server and browser console: no errors. Build: 178 pages, no warnings |
| 2 | All 14 page types render with sample data and link to each other | **Pass** | Crawled all 177 pages in `/out`: 6,295 internal links, 0 broken |
| 3 | Filters combine (country + budget + 3-year + MOI) and the URL keeps them | **Pass** | Unit test compares against a hand filter; browser: `?country=italy,hungary&budget=40&3yr=1&moi=1` → 17 programs, survives a language switch |
| 4 | Compare works for 2–4 programs and the share link reopens it | **Pass** | Browser: a 3-program link opened the same table; unit tests cap at 4 and drop duplicates |
| 5 | Match quiz saves the profile, ranks programs, shows gate reasons | **Pass** | Clicked through all 5 steps from an empty profile: saved, 13 eligible programs ranked with bands, the rest listed with reasons; validation stops an empty step |
| 6 | Fit Score unit tests pass, including every seed edge case | **Pass** | 30 Fit Score tests (gate, each part, bands, German-taught, bachelor's, scholarships) plus every sample program scored |
| 7 | Improvement tips show correct point gains | **Pass** | Test: IELTS 6.5 → 7.0 +4, 6 more months +3, a certificate +2; TOEFL tips convert to TOEFL scores |
| 8 | Chat answers fields, falls back to search, then copy-to-other-AI | **Pass** | Browser: tuition chip → field answer; "internship?" → overview sentence; "swimming pool?" → not in data + copy button; 24 chat tests incl. Bangla |
| 9 | Grade converter, cost calculator and timeline planner are correct | **Pass** | Unit tests (German/Italian/Hungarian scales, taka totals, backward dates) and checked in the browser |
| 10 | Saved list and profile survive a reload; profile export/import works | **Pass*** | Browser: saved program and profile survive reloads. Export/import logic is unit-tested (round trip, bad files rejected); *the file download and file picker weren't clicked in a browser* |
| 11 | Bangla/English toggle switches every UI string; lakh formatting is right | **Pass** | Test: both text files have the same keys and placeholders; scanned all Bangla pages for English digits; `৳ ১২.৫ লাখ` / `৳ 1.25 crore` tested. University and program names stay English by design; overviews without Bangla say so |
| 12 | Add-to-calendar downloads a valid .ics file | **Pass*** | Unit test: all-day event, CRLF, escaping, 75-byte folding, two reminders. *Not yet opened in a phone calendar app* |
| 13 | All forms validate and show "Preview mode: not sent" | **Pass** | Browser: empty and bad-email errors, then the preview notice; unit tests for all three forms |
| 14 | "Sample data" badge everywhere; footer disclaimer on every page | **Pass** | Checked all 177 pages for both |
| 15 | Fonts load from the project; no third-party requests | **Pass** | Network log: only the site itself; no outside URL in any loaded tag or stylesheet; fonts are in `app/fonts/` |
| 16 | Lighthouse mobile 90+ (performance, accessibility) on Home, Search, Program | **Pass** | Home 100/100, Search 95/100, Program 98/100 (Bangla Program 98/100). Measured with this PC's Kaspersky script blocked, since visitors won't have it |
| 17 | README explains run, build, Hostever deployment and adding data | **Pass** | [README.md](README.md) |

## Still to do on a real phone

The brief asks for every box to be ticked "on a real phone". Please try these on your Android phone (see README → "On your phone"):

1. Home → Search → a program → back; scroll the chip rows with your thumb.
2. Open **Filters**, pick a country and "Accepts 3-year degree", tap **Show programs**.
3. Do the **Match me** quiz; check your Fit Score on a program page.
4. On a program page tap **Add to calendar** and open the file in your calendar app.
5. On **My profile**, tap **Export file**, then **Import file** with the downloaded file.
6. Switch to **বাংলা** and dark mode; turn on **Lite mode** in More.
7. Tap **Share** on a program; check the share sheet opens.

## Known limits (by design in Stage 1)

- All data is invented sample data; links point to `example.org/sample/...`.
- Forms don't send anything (Stage 2 adds the backend and Turnstile).
- No admin dashboard, change monitor, outcome statistics or Telegram alerts yet (Stages 2–3).
