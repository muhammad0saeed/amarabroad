-- Two space savers (deletes rows, so it waits for Said's OK). Run after 12_robot_stats.sql.

-- 1. The robot's full page readings (extractions) are now kept only when a change waits for review;
--    nothing else reads them. field_changes.extraction stays as a plain id ("the reading, if still
--    kept"), so deleting old readings doesn't have to rewrite the change log.
alter table public.field_changes drop constraint if exists field_changes_extraction_fkey;
delete from public.extractions e
 where not exists (select 1 from public.field_changes f where f.extraction = e.id and f.status = 'held');

-- 2. Change-log rows replaced by a newer change of the same fact, after 30 days, are dropped (the
--    robot calls this once a day). The latest change per fact stays: it holds the sentence the site
--    shows as the source.
create or replace function public.robot_prune_log() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.field_changes f
   where f.status = 'applied'
     and f.created_at < now() - interval '30 days'
     and exists (
       select 1 from public.field_changes g
        where g.entity_type = f.entity_type and g.entity_slug = f.entity_slug and g.field = f.field
          and g.status = 'applied' and g.created_at > f.created_at);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.robot_prune_log() from public, anon, authenticated;
grant execute on function public.robot_prune_log() to service_role;

-- Afterwards, to hand the freed space back (takes seconds; run on its own, outside a transaction):
-- vacuum full public.extractions;
