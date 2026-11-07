-- amarAbroad: keep the robot's database small enough for the free Supabase plan (500 MB).
-- Paste into the Supabase SQL Editor once (already applied to the live project on 2026-11-07).

-- Database size in bytes, so the robot can stop adding new pages before the plan fills up
-- (a full free database turns read-only, which would also stop the site's forms).
create or replace function public.robot_db_size() returns bigint
language sql stable security definer set search_path = '' as $$
  select pg_database_size(current_database());
$$;
revoke all on function public.robot_db_size() from public, anon, authenticated;
grant execute on function public.robot_db_size() to service_role;

-- After a page is read: keep only its latest saved copy and latest reading, except readings that
-- explain a change still waiting for your review in /admin.
create or replace function public.robot_prune_source(p_source uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.page_snapshots s
   where s.source = p_source
     and s.id <> (select max(id) from public.page_snapshots where source = p_source);
  delete from public.extractions e
   where e.source = p_source
     and e.id <> (select max(id) from public.extractions where source = p_source)
     and not exists (select 1 from public.field_changes f where f.extraction = e.id and f.status = 'held');
$$;
revoke all on function public.robot_prune_source(uuid) from public, anon, authenticated;
grant execute on function public.robot_prune_source(uuid) to service_role;

-- One-off clean-up of what is already stored.
do $$
declare s uuid;
begin
  for s in select distinct source from public.page_snapshots loop
    perform public.robot_prune_source(s);
  end loop;
end $$;
