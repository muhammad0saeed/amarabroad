-- The news robot (robot/news.ts): links to news about student visas, universities and scholarships,
-- from official and education-news feeds. Only the headline and link are kept (never the article).
-- Removal rules (Said, 2026-11-08):
--   the article states a deadline         -> removed after that date (expires_on)
--   guides, tips, "no deadline" items      -> kept (expires_on null)
--   other news                             -> removed 4 months after it was published
--   links that stop working                -> removed
-- Run after 14_scholarship_rounds.sql.

create table if not exists public.news_links (
  id bigint generated always as identity primary key,
  url text not null unique,
  title text not null check (length(title) <= 300),
  source text not null,                            -- the feed's name ("GOV.UK: UK Visas and Immigration")
  official boolean not null default false,         -- a government or official body
  published_on date not null,
  countries text[] not null default '{}',          -- country slugs the headline is about
  topics text[] not null default '{}',             -- visa / scholarship / university / work / cost
  kind text not null check (kind in ('news','deadline','evergreen','open')),
  deadline date,                                   -- a deadline the headline states
  expires_on date,                                 -- removed after this day; null = kept
  checked_at timestamptz not null default now(),   -- the link was last seen working
  created_at timestamptz not null default now()
);
create index if not exists news_links_published_idx on public.news_links (published_on desc);

alter table public.news_links enable row level security;
drop policy if exists "read all" on public.news_links;
create policy "read all" on public.news_links for select to anon, authenticated using (true);
drop policy if exists "admins delete" on public.news_links;
create policy "admins delete" on public.news_links for delete to authenticated using ((select private.is_admin()));
revoke insert, update on public.news_links from anon, authenticated;
