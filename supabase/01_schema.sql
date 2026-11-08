-- amarAbroad database, part 1 of 3: tables and indexes.
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run again (it only adds what's missing).
--
-- Content tables mirror data/*.json (same column names), plus:
--   published    only published rows reach the public site
--   origin       where the row came from: 'sample' (Stage 1), 'robot' (the data robot), 'admin' (typed in /admin)
--   updated_at   set automatically on every change
-- Columns the robot may not find yet are nullable. The *_complete checks set the minimum a row needs
-- before it can be published.

-- Trigram search (typo-tolerant title search), kept in Supabase's extensions schema.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------- helpers

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- reference data

create table if not exists public.fields (
  slug text primary key,
  name_en text not null,
  name_bn text not null,
  field_group text not null check (field_group in ('computing','engineering','business','social','humanities','health','life_sciences','natural_sciences','design')),
  tile text not null default 'indigo',
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.degree_mappings (
  slug text primary key,
  label_en text not null,
  label_bn text not null,
  kind text not null check (kind in ('hsc','honours','pass','engineering','professional')),
  years smallint not null,
  field text not null references public.fields(slug) on update cascade,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.exchange_rates (
  currency text primary key check (currency ~ '^[A-Z]{3}$'),
  bdt_per_unit numeric(12,4) not null check (bdt_per_unit > 0),
  updated_on date not null,
  source_url text not null,
  last_verified date not null,
  is_sample boolean not null default false,
  origin text not null default 'admin' check (origin in ('sample','robot','admin')),
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.glossary_terms (
  slug text primary key,
  term text not null,
  term_bn text,
  explain_en text not null,
  explain_bn text not null,
  source_url text not null,
  last_verified date not null,
  is_sample boolean not null default false,
  origin text not null default 'admin' check (origin in ('sample','robot','admin')),
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- places

create table if not exists public.countries (
  slug text primary key,
  name_en text not null,
  name_bn text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  eu_member boolean not null default false,
  overview_en text not null default '',
  overview_bn text,
  education_system_en text not null default '',
  education_system_bn text,
  post_study_work_en text not null default '',
  post_study_work_bn text,
  student_work_hours smallint,
  student_work_note_en text not null default '',
  student_work_note_bn text,
  min_wage numeric(10,2),
  min_wage_note_en text not null default '',
  min_wage_note_bn text,
  visa_info_en text not null default '',
  visa_info_bn text,
  visa_info_url text not null default '',
  embassy_url text not null default '',
  photo jsonb,
  source_url text not null default '',
  last_verified date,
  is_sample boolean not null default false,
  origin text not null default 'admin' check (origin in ('sample','robot','admin')),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint countries_complete check (not published or (overview_en <> '' and last_verified is not null and student_work_hours is not null))
);

create table if not exists public.cities (
  slug text primary key,
  country text not null references public.countries(slug) on update cascade,
  name_en text not null,
  name_bn text not null,
  overview_en text not null default '',
  overview_bn text,
  population_students integer,
  cost_rent_shared numeric(10,2),
  cost_rent_studio numeric(10,2),
  cost_food numeric(10,2),
  cost_transport numeric(10,2),
  cost_phone numeric(10,2),
  cost_insurance numeric(10,2),
  local_language_needed_for_jobs text check (local_language_needed_for_jobs in ('essential','helpful','not_needed')),
  local_language_note_en text not null default '',
  local_language_note_bn text,
  common_student_jobs jsonb not null default '[]',
  bd_community_note_en text not null default '',
  bd_community_note_bn text,
  job_search_links jsonb not null default '[]',
  photo jsonb,
  source_url text not null default '',
  last_verified date,
  is_sample boolean not null default false,
  origin text not null default 'admin' check (origin in ('sample','robot','admin')),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cities_complete check (not published or (
    last_verified is not null and cost_rent_shared is not null and cost_rent_studio is not null and cost_food is not null
    and cost_transport is not null and cost_phone is not null and cost_insurance is not null and local_language_needed_for_jobs is not null
  ))
);
create index if not exists cities_country_idx on public.cities (country);

create table if not exists public.universities (
  slug text primary key,
  city text not null references public.cities(slug) on update cascade,
  name text not null,
  type text not null check (type in ('public','private')),
  accreditation text not null default '',
  eu_recognised boolean not null default false,
  ects boolean not null default false,
  ranking jsonb,
  website text not null,
  overview_en text not null default '',
  overview_bn text,
  source_url text not null default '',
  last_verified date,
  is_sample boolean not null default false,
  origin text not null default 'admin' check (origin in ('sample','robot','admin')),
  published boolean not null default false,
  discovered_at timestamptz,                       -- when the robot last searched its website for program pages
  program_pages_found integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint universities_complete check (not published or last_verified is not null)
);
create index if not exists universities_city_idx on public.universities (city);
create index if not exists universities_name_trgm on public.universities using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------- programs

create table if not exists public.programs (
  slug text primary key,
  university text not null references public.universities(slug) on update cascade,
  title text not null,
  degree_level text not null check (degree_level in ('bachelor','master')),
  field text references public.fields(slug) on update cascade,
  language text check (language ~ '^[a-z]{2}$'),
  language_requirement_en text,
  language_requirement_bn text,
  duration_months smallint check (duration_months between 1 and 120),
  ects_credits smallint,
  currency text check (currency ~ '^[A-Z]{3}$'),
  tuition_per_year numeric(12,2) check (tuition_per_year >= 0),
  other_fees_per_year numeric(12,2) not null default 0 check (other_fees_per_year >= 0),
  application_fee numeric(12,2) not null default 0 check (application_fee >= 0),
  intakes jsonb not null default '[]',           -- [{month, year, deadline}]
  seats_total integer,
  seats_non_eu integer,
  min_gpa_requirement jsonb,                       -- {value, scale, local_note_en?, local_note_bn?}; null = not stated
  -- Yes, no, or null = not stated on the official page ("not found" must never read as "no").
  accepts_3yr_bachelor boolean,
  accepts_moi boolean,
  accepts_provisional boolean,
  open_to_bd_citizens boolean not null default true,
  english_tests jsonb not null default '[]',      -- [{test, min_score}]
  required_documents text[] not null default '{}',
  related_bachelor_fields text[] not null default '{}',
  overview_en text not null default '',
  overview_bn text,
  career_paths_en text[] not null default '{}',
  career_paths_bn text[],
  official_url text not null,
  source_url text not null default '',
  last_verified date,
  is_sample boolean not null default false,
  origin text not null default 'admin' check (origin in ('sample','robot','admin')),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Filled in by trigger from english_tests / intakes, so filters can use plain indexes.
  ielts_min numeric(3,1),
  intake_months smallint[] not null default '{}',
  -- Fields an admin set by hand. The robot never overwrites them; a different value on the page is held for review.
  locked_fields text[] not null default '{}',
  -- A directory listing needs a subject and a check date; facts the robot couldn't find stay empty and
  -- the site shows "Not found, check the official page". Tuition needs its currency.
  constraint programs_complete check (not published or (
    field is not null and last_verified is not null and (tuition_per_year is null or currency is not null)
  ))
);
create index if not exists programs_university_idx on public.programs (university);
create index if not exists programs_field_idx on public.programs (field);
create index if not exists programs_level_idx on public.programs (degree_level);
create index if not exists programs_tuition_idx on public.programs (tuition_per_year);
create index if not exists programs_published_idx on public.programs (published) where published;
create index if not exists programs_title_trgm on public.programs using gin (title extensions.gin_trgm_ops);
create index if not exists programs_intake_months_idx on public.programs using gin (intake_months);

create or replace function public.programs_derive() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.ielts_min := (select min((t->>'min_score')::numeric) from jsonb_array_elements(new.english_tests) t where t->>'test' = 'ielts');
  new.intake_months := coalesce((select array_agg(distinct (i->>'month')::smallint) from jsonb_array_elements(new.intakes) i), '{}');
  return new;
end $$;

-- ---------------------------------------------------------------- scholarships

create table if not exists public.scholarships (
  slug text primary key,
  name text not null,
  provider text not null default '',
  type text not null check (type in ('merit','need','mixed')),
  bd_eligible boolean not null default true,
  levels text[] not null default '{}',
  coverage jsonb,                                  -- {tuition, tuition_percent?, stipend, summary_en, summary_bn?}
  deadline date,
  eligibility_summary_en text not null default '',
  eligibility_summary_bn text,
  evaluates text[] not null default '{}',
  official_url text not null,
  -- Where it applies; an empty list means "not limited at this level".
  countries text[] not null default '{}',
  universities text[] not null default '{}',
  programs text[] not null default '{}',
  source_url text not null default '',
  last_verified date,
  is_sample boolean not null default false,
  origin text not null default 'admin' check (origin in ('sample','robot','admin')),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scholarships_complete check (not published or (coverage is not null and deadline is not null and last_verified is not null))
);
create index if not exists scholarships_deadline_idx on public.scholarships (deadline);
create index if not exists scholarships_countries_idx on public.scholarships using gin (countries);
create index if not exists scholarships_universities_idx on public.scholarships using gin (universities);
create index if not exists scholarships_programs_idx on public.scholarships using gin (programs);

-- ---------------------------------------------------------------- reports from visitors

create table if not exists public.wrong_info_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  program text references public.programs(slug) on update cascade on delete set null,
  topic text not null check (topic in ('tuition','deadline','requirements','english','seats','scholarships','link','other')),
  correction text not null check (length(correction) between 10 and 2000),
  source_url text,
  email text,
  status text not null default 'new' check (status in ('new','working','fixed','rejected')),
  ip_hash text,                                    -- one-way hash of the sender's IP, only for the rate limit
  admin_note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null check (type in ('bug','wrong_info','page_not_loading','suggestion')),
  description text not null check (length(description) between 10 and 2000),
  page_url text,
  user_agent text,
  app_version text,
  email text,
  status text not null default 'new' check (status in ('new','working','fixed','rejected')),
  ip_hash text,                                    -- one-way hash of the sender's IP, only for the rate limit
  admin_note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.outcome_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  program text references public.programs(slug) on update cascade on delete set null,
  intake text not null check (intake ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  result text not null check (result in ('admitted','rejected','waitlisted')),
  cgpa numeric(4,2) not null,
  cgpa_scale smallint not null check (cgpa_scale in (4,5)),
  degree text not null,
  university_type text not null check (university_type in ('public','private','nu')),
  english_test text not null check (english_test in ('ielts','toefl_ibt','pte','duolingo','moi')),
  english_score numeric(5,1),
  experience_months smallint,
  tips text check (tips is null or length(tips) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  ip_hash text,                                    -- one-way hash of the sender's IP, only for the rate limit
  admin_note text,
  updated_at timestamptz not null default now()
);

create index if not exists wrong_info_reports_rate_idx on public.wrong_info_reports (ip_hash, created_at desc);
create index if not exists problem_reports_rate_idx on public.problem_reports (ip_hash, created_at desc);
create index if not exists outcome_reports_rate_idx on public.outcome_reports (ip_hash, created_at desc);

-- ---------------------------------------------------------------- admins

create table if not exists public.admins (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- the data robot
-- sources: every web page the robot watches. page_snapshots: a fingerprint of each version the robot read
-- (the page text itself is not kept: on the free plan the copies filled the database).
-- extractions: what the reading rules found in a snapshot. field_changes: every value the robot changed or held back,
-- with the exact sentence from the page as evidence. crawl_runs: one row per run, with counts.

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  kind text not null check (kind in ('university_home','program_list','program_page','scholarship_page','fees_page','deadlines_page')),
  entity_type text check (entity_type in ('university','program','scholarship')),
  entity_slug text,
  university text references public.universities(slug) on update cascade on delete cascade,
  status text not null default 'active' check (status in ('active','discovered','paused','gone','blocked')),
  check_every interval not null default interval '1 day',
  next_check_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  http_etag text,
  http_last_modified text,
  content_hash text,
  consecutive_errors smallint not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sources_due_idx on public.sources (next_check_at) where status in ('active','discovered');
create index if not exists sources_entity_idx on public.sources (entity_type, entity_slug);

create table if not exists public.page_snapshots (
  id bigint generated always as identity primary key,
  source uuid not null references public.sources(id) on delete cascade,
  fetched_at timestamptz not null default now(),
  http_status smallint not null,
  content_hash text not null,
  -- Always empty now; kept so older robot versions and readings still fit.
  text_content text not null default '',
  unique (source, content_hash)
);
create index if not exists page_snapshots_latest_idx on public.page_snapshots (source, fetched_at desc);

create table if not exists public.extractions (
  id bigint generated always as identity primary key,
  source uuid not null references public.sources(id) on delete cascade,
  snapshot bigint references public.page_snapshots(id) on delete set null,
  model text not null,
  result jsonb not null,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(10,5),
  created_at timestamptz not null default now()
);

create table if not exists public.field_changes (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('university','program','scholarship')),
  entity_slug text not null,
  field text not null,
  old_value jsonb,
  new_value jsonb,
  evidence text,                                   -- the sentence on the page the value came from
  source_url text,
  extraction bigint references public.extractions(id) on delete set null,
  status text not null check (status in ('applied','held','rejected','reverted')),
  reason text,                                     -- why it was held back, when it was
  decided_by text,                                 -- 'robot' or an admin email
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists field_changes_entity_idx on public.field_changes (entity_type, entity_slug, created_at desc);
create index if not exists field_changes_held_idx on public.field_changes (created_at desc) where status = 'held';

create table if not exists public.crawl_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  trigger text not null default 'schedule',
  pages_checked integer not null default 0,
  pages_changed integer not null default 0,
  changes_applied integer not null default 0,
  changes_held integer not null default 0,
  errors integer not null default 0,
  cost_usd numeric(10,4) not null default 0,
  notes text
);

-- Indexes for the links between tables (deletes and joins stay fast as the tables grow).
create index if not exists degree_mappings_field_idx on public.degree_mappings (field);
create index if not exists extractions_source_idx on public.extractions (source);
create index if not exists extractions_snapshot_idx on public.extractions (snapshot);
create index if not exists field_changes_extraction_idx on public.field_changes (extraction);
create index if not exists outcome_reports_program_idx on public.outcome_reports (program);
create index if not exists sources_university_idx on public.sources (university);
create index if not exists wrong_info_reports_program_idx on public.wrong_info_reports (program);

-- ---------------------------------------------------------------- triggers

do $$
declare t text;
begin
  foreach t in array array['fields','degree_mappings','exchange_rates','glossary_terms','countries','cities','universities','programs',
                           'scholarships','wrong_info_reports','problem_reports','outcome_reports','sources']
  loop
    execute format('drop trigger if exists touch_updated_at on public.%I', t);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Page search (search_program_pages) was removed on 2026-11-08 with the stored page copies; see 06_drop_page_copies.sql.
drop function if exists public.search_program_pages(text, integer);

drop trigger if exists programs_derive on public.programs;
create trigger programs_derive before insert or update of english_tests, intakes on public.programs
  for each row execute function public.programs_derive();
