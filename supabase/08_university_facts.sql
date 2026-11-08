-- amarAbroad: what universities' general pages say (fees for international students, English scores,
-- application deadlines, documents), found by the gap-filler robot (robot/university-info.ts).
-- Applied to the live project on 2026-11-09. Shown on program pages that have a gap, labelled as the
-- university's general page; never copied into a program's own fields.

alter table public.universities add column if not exists info_checked_at timestamptz;  -- when the robot last read its general pages

create table if not exists public.university_facts (
  id bigint generated always as identity primary key,
  university text not null references public.universities(slug) on delete cascade,
  field text not null check (field in ('tuition','application_fee','english','deadline','document')),
  level text check (level in ('bachelor','master')),     -- null: the page is about both levels
  value jsonb not null,
  quote text not null check (length(quote) <= 400),
  source_url text not null,
  checked_at date not null default current_date
);
create index if not exists university_facts_university_idx on public.university_facts (university);

-- Robot data: admins can read it in the dashboard; the website's server uses the secret key.
alter table public.university_facts enable row level security;
drop policy if exists "admins read" on public.university_facts;
create policy "admins read" on public.university_facts for select to authenticated using ((select private.is_admin()));
revoke all on public.university_facts from anon;
