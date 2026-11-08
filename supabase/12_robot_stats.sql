-- Robot stats for /admin and the public "collected by our robot" counter. Run after 11_more_subjects.sql.

-- What the robots did in the last 24 hours, the latest runs, and the database size: one call.
create or replace function public.robot_stats() returns jsonb
language sql stable security definer set search_path = '' as $$
  with since as (select now() - interval '24 hours' as t)
  select jsonb_build_object(
    'pages_checked', (select count(*) from public.sources, since where last_checked_at >= since.t),
    'page_errors', (select count(*) from public.sources, since where last_checked_at >= since.t and consecutive_errors > 0),
    'programs_found', (select count(*) from public.programs, since where created_at >= since.t),
    'programs_published', (select count(*) from public.programs, since where created_at >= since.t and published),
    -- Program pages watched before today that changed today (the change log is too big to count quickly).
    'programs_updated', (select count(*) from public.sources, since
                          where last_changed_at >= since.t and created_at < since.t and entity_type = 'program'),
    'facts_found', (select count(*) from public.university_facts where checked_at >= current_date - 1),
    'universities_searched', (select count(*) from public.universities, since where discovered_at >= since.t),
    'held', (select count(*) from public.field_changes where status = 'held'),
    'checks_agree', (select count(*) from public.fact_checks where status = 'agree'),
    'checks_conflict', (select count(*) from public.fact_checks where status = 'conflict'),
    'programs_total', (select count(*) from public.programs where published),
    'universities_total', (select count(*) from public.universities where published),
    'sources_total', (select count(*) from public.sources),
    'db_mb', (select round(pg_database_size(current_database()) / 1048576.0)),
    'runs', (select coalesce(jsonb_agg(r order by r.started_at desc), '[]'::jsonb) from (
               select id, trigger, started_at, finished_at, pages_checked, pages_changed, changes_applied, changes_held, errors, notes
                 from public.crawl_runs order by started_at desc limit 12) r)
  );
$$;
revoke all on function public.robot_stats() from public, anon, authenticated;
grant execute on function public.robot_stats() to service_role;
