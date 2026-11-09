// Makes supabase/17_country_guides_content.sql from data/country-guides.json (run: node scripts/country-guides-sql.mjs).
// Each guide fills its country's texts and publishes it; Bangla columns are left as they are.

import fs from "node:fs";

const guides = JSON.parse(fs.readFileSync("data/country-guides.json", "utf8"));
const CHECKED = "2026-11-09";
// Dollar quoting: the texts can contain any quote marks.
const text = (s) => `$g$${s}$g$`;
const json = (v) => `${text(JSON.stringify(v))}::jsonb`;
const num = (v) => (v === null || v === undefined ? "null" : String(v));

const lines = [
  "-- Country guides (made by scripts/country-guides-sql.mjs from data/country-guides.json; edit that file, not this one).",
  "-- Run after 16_country_guides.sql.",
  "",
];
for (const [slug, g] of Object.entries(guides)) {
  if (slug.startsWith("_")) continue;
  lines.push(
    `update public.countries set`,
    `  overview_en = ${text(g.overview_en)},`,
    `  education_system_en = ${text(g.education_system_en)},`,
    `  post_study_work_en = ${text(g.post_study_work_en)},`,
    `  student_work_hours = ${num(g.student_work_hours)},`,
    `  student_work_note_en = ${text(g.student_work_note_en)},`,
    `  min_wage = ${num(g.min_wage)},`,
    `  min_wage_note_en = ${text(g.min_wage_note_en)},`,
    `  visa_info_en = ${text(g.visa_info_en)},`,
    `  visa_info_url = ${text(g.visa_info_url)},`,
    `  embassy_url = ${text(g.embassy_url)},`,
    `  before_start = ${json(g.before_start)},`,
    `  part_time_jobs = ${json(g.part_time_jobs)},`,
    `  job_links = ${json(g.job_links)},`,
    `  reading = ${json(g.reading)},`,
    `  photo = ${json(g.photo)},`,
    `  source_url = ${text(g.visa_info_url)},`,
    `  last_verified = '${CHECKED}',`,
    `  published = true`,
    `where slug = '${slug}';`,
    "",
  );
}
fs.writeFileSync("supabase/17_country_guides_content.sql", lines.join("\n"));
console.log(`Wrote ${Object.keys(guides).filter((k) => !k.startsWith("_")).length} guides.`);
