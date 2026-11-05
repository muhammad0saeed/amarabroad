// What the content manager can edit, table by table. Plain data (no functions), so the same
// definitions drive the server pages, the form in the browser, and the save action.

export type Option = [value: string, label: string];

export type Column =
  | { name: string; label: string; kind: "text" | "url" | "date" | "textarea"; required?: boolean }
  | { name: string; label: string; kind: "number"; required?: boolean; step?: number }
  | { name: string; label: string; kind: "select"; options: Option[]; required?: boolean; numeric?: boolean };

export type Field = { name: string; label: string; hint?: string; required?: boolean } & (
  | { kind: "text" | "url" | "date"; maxLength?: number }
  | { kind: "textarea"; rows?: number }
  | { kind: "number"; step?: number; min?: number; max?: number }
  /** not-null yes/no */
  | { kind: "bool" }
  /** yes / no / not stated (null) */
  | { kind: "tri" }
  | { kind: "select"; options: Option[] }
  /** a row of another table, e.g. a program's university */
  | { kind: "ref"; table: TableKey }
  /** text[]: one per line */
  | { kind: "lines" }
  /** text[] from fixed options (or another table's rows) */
  | { kind: "multi"; options?: Option[]; table?: TableKey }
  /** jsonb array of small objects, e.g. intakes */
  | { kind: "rows"; columns: Column[] }
  /** jsonb object (null when every box is empty); dotted names reach nested keys */
  | { kind: "group"; columns: Column[] }
  /** jsonb, anything else */
  | { kind: "json" }
);

export interface Section {
  title: string;
  fields: Field[];
}

export interface TableSpec {
  key: TableKey;
  label: string;
  one: string;
  /** primary key column */
  id: "slug" | "currency";
  /** the column shown as the row's name, and searched */
  name: string;
  /** extra columns in the list */
  list: { name: string; label: string }[];
  /** has published + last_verified (the "check date") */
  verified: boolean;
  /** robot or admin wrote it: field_changes can log edits for it */
  logged?: "program" | "university" | "scholarship";
  sections: Section[];
}

export type TableKey =
  | "programs" | "universities" | "cities" | "countries" | "scholarships" | "exchange_rates" | "fields" | "degree_mappings" | "glossary_terms";

// ---------------------------------------------------------------- shared option lists

const MONTHS: Option[] = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => [String(i + 1), m]);
const TESTS: Option[] = [["ielts", "IELTS"], ["toefl_ibt", "TOEFL iBT"], ["pte", "PTE Academic"], ["duolingo", "Duolingo"]];
const DOCUMENTS: Option[] = [
  ["passport", "Passport"], ["transcript", "Transcript"], ["degree_certificate", "Degree certificate"], ["hsc_certificate", "HSC certificate"],
  ["cv", "CV"], ["motivation_letter", "Motivation letter"], ["recommendation_letters", "Recommendation letters"], ["english_certificate", "English test certificate"],
  ["moi_letter", "Medium of instruction letter"], ["portfolio", "Portfolio"], ["course_descriptions", "Course descriptions"], ["work_certificate", "Work certificate"],
];
const LEVELS: Option[] = [["bachelor", "Bachelor"], ["master", "Master"]];
const LANGUAGES: Option[] = [["en", "English"], ["de", "German"], ["it", "Italian"], ["hu", "Hungarian"], ["fr", "French"], ["es", "Spanish"], ["nl", "Dutch"], ["pl", "Polish"], ["cs", "Czech"], ["fi", "Finnish"], ["sv", "Swedish"], ["pt", "Portuguese"]];
const FIELD_GROUPS: Option[] = ["computing", "engineering", "business", "social", "humanities", "health", "life_sciences", "natural_sciences", "design"].map((g) => [g, g.replace("_", " ")]);
const TILES: Option[] = ["indigo", "blue", "teal", "green", "amber", "pink"].map((t) => [t, t]);

const PHOTO: Field = {
  name: "photo", label: "Photo", kind: "group", hint: "A file in /public/photos and who took it.",
  columns: [{ name: "src", label: "File (e.g. /photos/milan.webp)", kind: "text" }, { name: "credit", label: "Credit", kind: "text" }, { name: "source_url", label: "Where it's from", kind: "url" }],
};
const CHECK: Section = {
  title: "Checking",
  fields: [
    { name: "source_url", label: "Where the facts come from", kind: "url" },
    { name: "last_verified", label: "Last checked against the official page", kind: "date", hint: "The site shows this date. Tick \"Checked today\" when saving instead of typing it." },
    { name: "published", label: "Show on the site", kind: "bool", hint: "The database refuses to show a row that's missing what the site needs (it tells you what)." },
  ],
};

// ---------------------------------------------------------------- tables

export const TABLES: Record<TableKey, TableSpec> = {
  programs: {
    key: "programs", label: "Programs", one: "program", id: "slug", name: "title", verified: true, logged: "program",
    list: [{ name: "university", label: "University" }, { name: "degree_level", label: "Level" }, { name: "field", label: "Subject" }],
    sections: [
      {
        title: "Basics",
        fields: [
          { name: "title", label: "Name", kind: "text", required: true, maxLength: 200 },
          { name: "university", label: "University", kind: "ref", table: "universities", required: true },
          { name: "degree_level", label: "Level", kind: "select", options: LEVELS, required: true },
          { name: "field", label: "Subject", kind: "ref", table: "fields", hint: "Needed before the program can show on the site." },
          { name: "related_bachelor_fields", label: "Bachelor subjects that fit (for masters)", kind: "multi", table: "fields" },
          { name: "official_url", label: "Official page", kind: "url", required: true },
        ],
      },
      {
        title: "Length and language",
        fields: [
          { name: "duration_months", label: "Length (months)", kind: "number", min: 1, max: 120 },
          { name: "ects_credits", label: "ECTS credits", kind: "number", min: 1, max: 400 },
          { name: "language", label: "Taught in", kind: "select", options: LANGUAGES },
          { name: "language_requirement_en", label: "Language requirement (English)", kind: "textarea", rows: 2 },
          { name: "language_requirement_bn", label: "Language requirement (Bangla)", kind: "textarea", rows: 2 },
        ],
      },
      {
        title: "Money",
        fields: [
          { name: "currency", label: "Currency", kind: "text", maxLength: 3, hint: "Three letters, e.g. EUR. Needed when tuition is filled in." },
          { name: "tuition_per_year", label: "Tuition per year (non-EU students)", kind: "number", min: 0, step: 0.01, hint: "Empty = not found. 0 = tuition-free." },
          { name: "other_fees_per_year", label: "Other fees per year", kind: "number", min: 0, step: 0.01, required: true },
          { name: "application_fee", label: "Application fee", kind: "number", min: 0, step: 0.01, required: true },
        ],
      },
      {
        title: "Intakes and deadlines",
        fields: [
          {
            name: "intakes", label: "Intakes", kind: "rows", hint: "One row per start date. Leave a row empty to remove it.",
            columns: [
              { name: "month", label: "Starts (month)", kind: "select", options: MONTHS, numeric: true, required: true },
              { name: "year", label: "Year", kind: "number", required: true },
              { name: "deadline", label: "Apply by", kind: "date", required: true },
            ],
          },
          { name: "seats_total", label: "Seats (all)", kind: "number", min: 0 },
          { name: "seats_non_eu", label: "Seats (non-EU)", kind: "number", min: 0 },
        ],
      },
      {
        title: "Who can apply",
        fields: [
          {
            name: "english_tests", label: "English tests accepted", kind: "rows",
            columns: [{ name: "test", label: "Test", kind: "select", options: TESTS, required: true }, { name: "min_score", label: "Minimum score", kind: "number", step: 0.5, required: true }],
          },
          {
            name: "min_gpa_requirement", label: "Minimum grade", kind: "group", hint: "On a 4- or 5-point scale, like a Bangladeshi CGPA. Empty = not stated.",
            columns: [
              { name: "value", label: "Minimum", kind: "number", step: 0.01, required: true },
              { name: "scale", label: "Out of", kind: "select", options: [["4", "4"], ["5", "5"]], numeric: true, required: true },
              { name: "local_note_en", label: "Note", kind: "text" },
            ],
          },
          { name: "accepts_moi", label: "Accepts a medium-of-instruction letter instead of a test", kind: "tri" },
          { name: "accepts_3yr_bachelor", label: "Accepts a 3-year bachelor", kind: "tri" },
          { name: "accepts_provisional", label: "Accepts students who haven't graduated yet", kind: "tri" },
          { name: "open_to_bd_citizens", label: "Open to Bangladeshi citizens", kind: "bool" },
          { name: "required_documents", label: "Documents to send", kind: "multi", options: DOCUMENTS },
        ],
      },
      {
        title: "Description",
        fields: [
          { name: "overview_en", label: "Overview (English)", kind: "textarea", rows: 4 },
          { name: "overview_bn", label: "Overview (Bangla)", kind: "textarea", rows: 4 },
          { name: "career_paths_en", label: "Careers (English, one per line)", kind: "lines" },
          { name: "career_paths_bn", label: "Careers (Bangla, one per line)", kind: "lines" },
        ],
      },
      CHECK,
    ],
  },

  universities: {
    key: "universities", label: "Universities", one: "university", id: "slug", name: "name", verified: true, logged: "university",
    list: [{ name: "city", label: "City" }, { name: "type", label: "Type" }, { name: "program_pages_found", label: "Pages found" }],
    sections: [
      {
        title: "Basics",
        fields: [
          { name: "name", label: "Name", kind: "text", required: true },
          { name: "city", label: "City", kind: "ref", table: "cities", required: true },
          { name: "type", label: "Type", kind: "select", options: [["public", "Public"], ["private", "Private"]], required: true },
          { name: "website", label: "Website", kind: "url", required: true, hint: "The robot searches this site for program pages." },
          { name: "accreditation", label: "Accreditation", kind: "text" },
          { name: "eu_recognised", label: "Degree recognised in the EU", kind: "bool" },
          { name: "ects", label: "Uses ECTS credits", kind: "bool" },
          {
            name: "ranking", label: "Ranking", kind: "group",
            columns: [{ name: "source", label: "Ranking", kind: "text", required: true }, { name: "rank", label: "Rank", kind: "text", required: true }, { name: "year", label: "Year", kind: "number" }, { name: "url", label: "Link", kind: "url" }],
          },
        ],
      },
      { title: "Description", fields: [{ name: "overview_en", label: "Overview (English)", kind: "textarea", rows: 4 }, { name: "overview_bn", label: "Overview (Bangla)", kind: "textarea", rows: 4 }] },
      CHECK,
    ],
  },

  cities: {
    key: "cities", label: "Cities", one: "city", id: "slug", name: "name_en", verified: true,
    list: [{ name: "country", label: "Country" }, { name: "cost_rent_shared", label: "Shared room" }],
    sections: [
      {
        title: "Basics",
        fields: [
          { name: "name_en", label: "Name (English)", kind: "text", required: true },
          { name: "name_bn", label: "Name (Bangla)", kind: "text", required: true },
          { name: "country", label: "Country", kind: "ref", table: "countries", required: true },
          { name: "population_students", label: "Students in the city", kind: "number", min: 0 },
          { name: "overview_en", label: "Overview (English)", kind: "textarea", rows: 3 },
          { name: "overview_bn", label: "Overview (Bangla)", kind: "textarea", rows: 3 },
        ],
      },
      {
        title: "Monthly costs (local currency)",
        fields: [
          { name: "cost_rent_shared", label: "Shared room", kind: "number", min: 0, step: 0.01 },
          { name: "cost_rent_studio", label: "Studio", kind: "number", min: 0, step: 0.01 },
          { name: "cost_food", label: "Food", kind: "number", min: 0, step: 0.01 },
          { name: "cost_transport", label: "Transport", kind: "number", min: 0, step: 0.01 },
          { name: "cost_phone", label: "Phone and internet", kind: "number", min: 0, step: 0.01 },
          { name: "cost_insurance", label: "Health insurance", kind: "number", min: 0, step: 0.01 },
        ],
      },
      {
        title: "Jobs and community",
        fields: [
          { name: "local_language_needed_for_jobs", label: "Local language for jobs", kind: "select", options: [["essential", "Essential"], ["helpful", "Helpful"], ["not_needed", "Not needed"]] },
          { name: "local_language_note_en", label: "Language note (English)", kind: "textarea", rows: 2 },
          { name: "local_language_note_bn", label: "Language note (Bangla)", kind: "textarea", rows: 2 },
          { name: "common_student_jobs", label: "Common student jobs", kind: "rows", columns: [{ name: "en", label: "English", kind: "text", required: true }, { name: "bn", label: "Bangla", kind: "text" }] },
          { name: "job_search_links", label: "Job search links", kind: "rows", columns: [{ name: "label", label: "Name", kind: "text", required: true }, { name: "url", label: "Link", kind: "url", required: true }] },
          { name: "bd_community_note_en", label: "Bangladeshi community (English)", kind: "textarea", rows: 2 },
          { name: "bd_community_note_bn", label: "Bangladeshi community (Bangla)", kind: "textarea", rows: 2 },
          PHOTO,
        ],
      },
      CHECK,
    ],
  },

  countries: {
    key: "countries", label: "Countries", one: "country", id: "slug", name: "name_en", verified: true,
    list: [{ name: "currency", label: "Currency" }, { name: "student_work_hours", label: "Work hours" }],
    sections: [
      {
        title: "Basics",
        fields: [
          { name: "name_en", label: "Name (English)", kind: "text", required: true },
          { name: "name_bn", label: "Name (Bangla)", kind: "text", required: true },
          { name: "currency", label: "Currency", kind: "text", maxLength: 3, required: true },
          { name: "eu_member", label: "EU member", kind: "bool" },
          { name: "overview_en", label: "Overview (English)", kind: "textarea", rows: 4 },
          { name: "overview_bn", label: "Overview (Bangla)", kind: "textarea", rows: 4 },
          { name: "education_system_en", label: "Education system (English)", kind: "textarea", rows: 3 },
          { name: "education_system_bn", label: "Education system (Bangla)", kind: "textarea", rows: 3 },
        ],
      },
      {
        title: "Work and visa",
        fields: [
          { name: "student_work_hours", label: "Students may work (hours a week)", kind: "number", min: 0, max: 60 },
          { name: "student_work_note_en", label: "Work note (English)", kind: "textarea", rows: 2 },
          { name: "student_work_note_bn", label: "Work note (Bangla)", kind: "textarea", rows: 2 },
          { name: "min_wage", label: "Minimum wage (per hour)", kind: "number", min: 0, step: 0.01 },
          { name: "min_wage_note_en", label: "Wage note (English)", kind: "textarea", rows: 2 },
          { name: "min_wage_note_bn", label: "Wage note (Bangla)", kind: "textarea", rows: 2 },
          { name: "post_study_work_en", label: "Work after graduating (English)", kind: "textarea", rows: 3 },
          { name: "post_study_work_bn", label: "Work after graduating (Bangla)", kind: "textarea", rows: 3 },
          { name: "visa_info_en", label: "Student visa (English)", kind: "textarea", rows: 3 },
          { name: "visa_info_bn", label: "Student visa (Bangla)", kind: "textarea", rows: 3 },
          { name: "visa_info_url", label: "Official visa page", kind: "url" },
          { name: "embassy_url", label: "Embassy for Bangladesh", kind: "url" },
          PHOTO,
        ],
      },
      CHECK,
    ],
  },

  scholarships: {
    key: "scholarships", label: "Scholarships", one: "scholarship", id: "slug", name: "name", verified: true, logged: "scholarship",
    list: [{ name: "provider", label: "Provider" }, { name: "deadline", label: "Deadline" }],
    sections: [
      {
        title: "Basics",
        fields: [
          { name: "name", label: "Name", kind: "text", required: true },
          { name: "provider", label: "Provider", kind: "text" },
          { name: "type", label: "Type", kind: "select", options: [["merit", "Merit"], ["need", "Need"], ["mixed", "Both"]], required: true },
          { name: "bd_eligible", label: "Bangladeshis can apply", kind: "bool" },
          { name: "levels", label: "For", kind: "multi", options: LEVELS },
          { name: "deadline", label: "Deadline", kind: "date", hint: "Needed before it can show on the site." },
          { name: "official_url", label: "Official page", kind: "url", required: true },
        ],
      },
      {
        title: "What it pays",
        fields: [
          {
            name: "coverage", label: "Coverage", kind: "group", hint: "Needed before it can show on the site.",
            columns: [
              { name: "tuition", label: "Tuition", kind: "select", options: [["full", "Full"], ["partial", "Partial"], ["none", "None"]], required: true },
              { name: "tuition_percent", label: "Tuition % (if partial)", kind: "number" },
              { name: "stipend.amount", label: "Cash grant", kind: "number" },
              { name: "stipend.currency", label: "Grant currency", kind: "text" },
              { name: "stipend.per", label: "Per", kind: "select", options: [["month", "Month"], ["year", "Year"], ["once", "Once"]] },
              { name: "summary_en", label: "Summary (English)", kind: "textarea", required: true },
              { name: "summary_bn", label: "Summary (Bangla)", kind: "textarea" },
            ],
          },
        ],
      },
      {
        title: "Who gets it",
        fields: [
          { name: "eligibility_summary_en", label: "Eligibility (English)", kind: "textarea", rows: 3 },
          { name: "eligibility_summary_bn", label: "Eligibility (Bangla)", kind: "textarea", rows: 3 },
          { name: "evaluates", label: "What they look at", kind: "multi", options: ["academics", "english", "research", "experience", "extracurricular", "leadership"].map((e) => [e, e]) },
          { name: "countries", label: "Countries", kind: "multi", table: "countries", hint: "Empty = any." },
          { name: "universities", label: "Universities", kind: "multi", table: "universities", hint: "Empty = any." },
          { name: "programs", label: "Programs (slugs, one per line)", kind: "lines", hint: "Empty = any." },
        ],
      },
      CHECK,
    ],
  },

  exchange_rates: {
    key: "exchange_rates", label: "Exchange rates", one: "rate", id: "currency", name: "currency", verified: true,
    list: [{ name: "bdt_per_unit", label: "Taka per unit" }, { name: "updated_on", label: "Rate date" }],
    sections: [
      {
        title: "Rate",
        fields: [
          { name: "bdt_per_unit", label: "Taka for 1 unit", kind: "number", min: 0.0001, step: 0.0001, required: true },
          { name: "updated_on", label: "Rate date", kind: "date", required: true },
          { name: "source_url", label: "Where the rate comes from", kind: "url", required: true },
          { name: "last_verified", label: "Last checked", kind: "date", required: true },
          { name: "published", label: "Use on the site", kind: "bool" },
        ],
      },
    ],
  },

  fields: {
    key: "fields", label: "Subjects", one: "subject", id: "slug", name: "name_en", verified: false,
    list: [{ name: "field_group", label: "Group" }],
    sections: [
      {
        title: "Subject",
        fields: [
          { name: "name_en", label: "Name (English)", kind: "text", required: true },
          { name: "name_bn", label: "Name (Bangla)", kind: "text", required: true },
          { name: "field_group", label: "Group", kind: "select", options: FIELD_GROUPS, required: true },
          { name: "tile", label: "Tile colour", kind: "select", options: TILES, required: true },
          { name: "published", label: "Show on the site", kind: "bool" },
        ],
      },
    ],
  },

  degree_mappings: {
    key: "degree_mappings", label: "Bangladeshi degrees", one: "degree", id: "slug", name: "label_en", verified: false,
    list: [{ name: "kind", label: "Kind" }, { name: "years", label: "Years" }, { name: "field", label: "Subject" }],
    sections: [
      {
        title: "Degree",
        fields: [
          { name: "label_en", label: "Name (English)", kind: "text", required: true },
          { name: "label_bn", label: "Name (Bangla)", kind: "text", required: true },
          { name: "kind", label: "Kind", kind: "select", options: [["hsc", "HSC"], ["honours", "Honours"], ["pass", "Pass"], ["engineering", "Engineering"], ["professional", "Professional"]], required: true },
          { name: "years", label: "Years", kind: "number", min: 1, max: 8, required: true },
          { name: "field", label: "Subject", kind: "ref", table: "fields", required: true },
          { name: "published", label: "Show on the site", kind: "bool" },
        ],
      },
    ],
  },

  glossary_terms: {
    key: "glossary_terms", label: "Glossary", one: "term", id: "slug", name: "term", verified: true,
    list: [],
    sections: [
      {
        title: "Term",
        fields: [
          { name: "term", label: "Term", kind: "text", required: true },
          { name: "term_bn", label: "Term (Bangla)", kind: "text" },
          { name: "explain_en", label: "Explanation (English)", kind: "textarea", rows: 3, required: true },
          { name: "explain_bn", label: "Explanation (Bangla)", kind: "textarea", rows: 3, required: true },
          { name: "source_url", label: "Source", kind: "url", required: true },
          { name: "last_verified", label: "Last checked", kind: "date", required: true },
          { name: "published", label: "Show on the site", kind: "bool" },
        ],
      },
    ],
  },
};

export const TABLE_ORDER: TableKey[] = ["programs", "universities", "cities", "countries", "scholarships", "exchange_rates", "fields", "degree_mappings", "glossary_terms"];

export function isTable(key: string): key is TableKey {
  return key in TABLES;
}

export function allFields(spec: TableSpec): Field[] {
  return spec.sections.flatMap((s) => s.fields);
}

/** The column a ref/multi shows for another table's rows. */
export function refLabel(table: TableKey): { id: string; name: string } {
  const t = TABLES[table];
  return { id: t.id, name: t.name };
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

// ---------------------------------------------------------------- reading a submitted form

export const STALE_DAYS = 60;

function getPath(o: Record<string, unknown> | null | undefined, path: string): unknown {
  return path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), o);
}
function setPath(o: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let cur = o;
  for (const k of keys.slice(0, -1)) cur = (cur[k] ??= {}) as Record<string, unknown>;
  cur[keys.at(-1)!] = value;
}
export { getPath };

type Read = { ok: true; value: unknown } | { ok: false; error: string };

function readColumn(col: Column, raw: string): Read {
  const v = raw.trim();
  if (!v) return { ok: true, value: undefined };
  if (col.kind === "number" || (col.kind === "select" && col.numeric)) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: `${col.label}: not a number` };
  }
  if (col.kind === "url" && !/^https?:\/\/\S+$/.test(v)) return { ok: false, error: `${col.label}: must start with http:// or https://` };
  if (col.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, error: `${col.label}: not a date` };
  return { ok: true, value: v };
}

/** One object from a row/group of boxes; null when every box is empty. */
function readObject(f: Field & { columns: Column[] }, get: (col: string) => string, where: string): Read {
  const obj: Record<string, unknown> = {};
  let filled = 0;
  const missing: string[] = [];
  for (const col of f.columns) {
    const r = readColumn(col, get(col.name));
    if (!r.ok) return { ok: false, error: `${where}${r.error}` };
    if (r.value === undefined) {
      if (col.required) missing.push(col.label);
      continue;
    }
    filled++;
    setPath(obj, col.name, r.value);
  }
  if (!filled) return { ok: true, value: null };
  if (missing.length) return { ok: false, error: `${where}fill in ${missing.join(", ")} too (or empty the whole row)` };
  return { ok: true, value: obj };
}

/** Turns the submitted form into column values, or the problems to show. */
export function readForm(spec: TableSpec, form: FormData): { values: Record<string, unknown>; errors: Record<string, string> } {
  const values: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const text = (name: string) => String(form.get(name) ?? "");

  for (const f of allFields(spec)) {
    const key = `f.${f.name}`;
    const raw = text(key).trim();
    let value: unknown;
    switch (f.kind) {
      case "text":
      case "url":
      case "date":
      case "textarea": {
        if (f.kind === "url" && raw && !/^https?:\/\/\S+$/.test(raw)) errors[f.name] = "Must start with http:// or https://";
        if (f.kind === "date" && raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) errors[f.name] = "Not a date";
        if (f.kind === "text" && f.maxLength && raw.length > f.maxLength) errors[f.name] = `At most ${f.maxLength} characters`;
        value = raw || null;
        if (f.name === "currency" && raw) value = raw.toUpperCase();
        break;
      }
      case "number": {
        if (!raw) value = null;
        else {
          const n = Number(raw.replace(/,/g, ""));
          if (!Number.isFinite(n)) errors[f.name] = "Not a number";
          else if (f.min !== undefined && n < f.min) errors[f.name] = `At least ${f.min}`;
          else if (f.max !== undefined && n > f.max) errors[f.name] = `At most ${f.max}`;
          value = n;
        }
        break;
      }
      case "bool":
        value = form.get(key) === "on";
        break;
      case "tri":
        value = raw === "yes" ? true : raw === "no" ? false : null;
        break;
      case "select":
      case "ref":
        value = raw || null;
        break;
      case "lines":
        value = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        break;
      case "multi":
        value = form.getAll(key).map(String).filter(Boolean);
        break;
      case "rows": {
        const count = Number(form.get(`${key}.count`) ?? 0);
        const rows: unknown[] = [];
        for (let i = 0; i < count; i++) {
          const r = readObject(f, (c) => text(`${key}.${i}.${c}`), `Row ${i + 1}: `);
          if (!r.ok) errors[f.name] ??= r.error;
          else if (r.value) rows.push(r.value);
        }
        value = rows;
        break;
      }
      case "group": {
        const r = readObject(f, (c) => text(`${key}.${c}`), "");
        if (!r.ok) errors[f.name] = r.error;
        else value = r.value;
        break;
      }
      case "json": {
        if (!raw) value = null;
        else
          try {
            value = JSON.parse(raw);
          } catch {
            errors[f.name] = "Not valid JSON";
          }
        break;
      }
    }
    if (f.required && (value === null || value === "" || (Array.isArray(value) && !value.length))) errors[f.name] ??= "Required";
    values[f.name] = value;
  }
  return { values, errors };
}

/** Same value? (numbers from the database arrive as strings, JSON keys in any order) */
export function sameValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): unknown => {
    if (v === undefined || v === "") return null;
    if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])]));
    return v;
  };
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

/** Program columns the robot maintains: editing one by hand locks it (see programs.locked_fields). */
export const ROBOT_FIELDS = new Set([
  "degree_level", "field", "related_bachelor_fields", "duration_months", "ects_credits", "language", "language_requirement_en",
  "currency", "tuition_per_year", "other_fees_per_year", "application_fee", "intakes", "english_tests", "accepts_moi",
  "accepts_3yr_bachelor", "accepts_provisional", "min_gpa_requirement", "seats_total", "seats_non_eu", "required_documents",
  "overview_en", "career_paths_en",
]);
