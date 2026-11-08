-- Scholarships show where their round stands (open / closed / varies / not announced) and their usual
-- timeline, instead of only appearing while a deadline is known. Run after 12_robot_stats.sql.

alter table public.scholarships add column if not exists round_status text not null default 'unknown'
  check (round_status in ('open','closed','varies','unknown'));
alter table public.scholarships add column if not exists last_deadline date;       -- last round's closing date
alter table public.scholarships add column if not exists deadline_quote text;      -- the sentence the deadline/status came from
alter table public.scholarships add column if not exists cycle_en text;            -- the usual yearly timeline
alter table public.scholarships add column if not exists cycle_bn text;

-- A deadline is no longer required to publish: a closed round is still worth showing.
alter table public.scholarships drop constraint if exists scholarships_complete;
alter table public.scholarships add constraint scholarships_complete
  check (not published or (coverage is not null and last_verified is not null));
