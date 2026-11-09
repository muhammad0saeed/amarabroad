-- Country guides: "before you start" steps, popular part-time jobs, job sites, and further reading
-- (official and reputable pages, linked with credit, never copied). Run after 15_news.sql.

alter table public.countries add column if not exists before_start jsonb not null default '[]';   -- [{en, bn?}]
alter table public.countries add column if not exists part_time_jobs jsonb not null default '[]'; -- [{en, bn?}]
alter table public.countries add column if not exists job_links jsonb not null default '[]';      -- [{name, url}]
alter table public.countries add column if not exists reading jsonb not null default '[]';        -- [{title, source, url}]
