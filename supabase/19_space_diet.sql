-- amarAbroad: keep the database well inside the free plan (applied to the live project on 2026-11-16,
-- with Said's OK: it deletes robot records nobody sees). Run after 18_catalog_ranges.sql.
--
-- Where the space went (364 MB): the change log 160 MB, watched page addresses 93 MB, programs 62 MB.
--   * 44,000 addresses were pages the robot had already rejected (not a program, gone, closed to robots),
--     kept only so discovery wouldn't queue them again. A 52-bit fingerprint does that in 1/20 of the space.
--   * 84,000 change-log rows could never be shown: replaced by a newer row, or with no sentence from a page
--     ("(subject chosen by the robot)").
--   * Page fingerprints (page_snapshots) are only needed while a reading waits for review.

-- 1. Fingerprints of rejected pages (robot/db.ts urlHash makes the same number).
create table if not exists public.rejected_pages (
  url_hash bigint primary key,
  rejected_at date not null default current_date
);
alter table public.rejected_pages enable row level security;
revoke all on public.rejected_pages from anon, authenticated;

insert into public.rejected_pages (url_hash, rejected_at)
select ('x' || substr(md5(url), 1, 13))::bit(52)::bigint, coalesce(last_checked_at::date, current_date)
  from public.sources
 where kind = 'program_page' and entity_slug is null
   and (last_error in ('not a single program page', 'not an HTML page') or last_error like 'robots.txt%'
        or (consecutive_errors >= 3 and (last_error like 'HTTP 404%' or last_error like 'HTTP 410%')))
on conflict (url_hash) do nothing;

delete from public.sources
 where kind = 'program_page' and entity_slug is null
   and (last_error in ('not a single program page', 'not an HTML page') or last_error like 'robots.txt%'
        or (consecutive_errors >= 3 and (last_error like 'HTTP 404%' or last_error like 'HTTP 410%')));

-- 2. Which version of the reading rules last read a page, so "read again after the rules improved"
--    happens once per page, not every shift.
alter table public.sources add column if not exists read_rules smallint;

-- 3. The change log keeps what the site shows: the latest row per fact, if it has a sentence from a page.
--    Rows waiting for review (held), rejected ones and hand edits are never touched.
create or replace function public.robot_prune_log() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer; total integer := 0;
begin
  -- replaced by a newer applied row of the same fact
  delete from public.field_changes f
   where f.status = 'applied'
     and exists (
       select 1 from public.field_changes g
        where g.entity_type = f.entity_type and g.entity_slug = f.entity_slug and g.field = f.field
          and g.status = 'applied' and (g.created_at > f.created_at or (g.created_at = f.created_at and g.id > f.id)));
  get diagnostics n = row_count; total := total + n;
  -- the robot's own notes in brackets, after two days (the admin's "applied" list shows recent ones)
  delete from public.field_changes f
   where f.status = 'applied' and f.decided_by = 'robot'
     and (f.evidence is null or f.evidence like '(%')
     and f.created_at < now() - interval '2 days';
  get diagnostics n = row_count; total := total + n;
  -- rows of programs that no longer exist
  delete from public.field_changes f
   where f.entity_type = 'program' and f.status = 'applied'
     and not exists (select 1 from public.programs p where p.slug = f.entity_slug);
  get diagnostics n = row_count; total := total + n;
  return total;
end $$;
revoke all on function public.robot_prune_log() from public, anon, authenticated;
grant execute on function public.robot_prune_log() to service_role;

select public.robot_prune_log();

-- 4. Page fingerprints no reading points to.
delete from public.page_snapshots s
 where not exists (select 1 from public.extractions e where e.snapshot = s.id);

-- Afterwards, each on its own (they can't run inside a transaction), to hand the freed space back:
--   vacuum full public.field_changes;
--   vacuum full public.sources;
--   vacuum full public.page_snapshots;
--   vacuum full public.programs;
