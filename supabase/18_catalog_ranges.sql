-- Loading the program list in slices without OFFSET. With OFFSET, the 8th slice of 1,000 made the database
-- walk past 7,000 programs first; while the robots kept it busy, that went over the 8-second limit for
-- website requests and failed deploys. Now one call returns where each slice starts, and each slice is
-- read straight from the index. Run after 17_country_guides_content.sql.

create index if not exists programs_published_slug_idx on public.programs (slug) where published;

-- The first slug of every slice of p_size published programs, in order.
create or replace function public.catalog_slug_bounds(p_size integer default 1000) returns setof text
language sql stable security definer set search_path = '' as $$
  select slug from (
    select slug, row_number() over (order by slug) as n from public.programs where published
  ) x
  where (n - 1) % p_size = 0
  order by slug;
$$;
revoke all on function public.catalog_slug_bounds(integer) from public, anon, authenticated;
grant execute on function public.catalog_slug_bounds(integer) to service_role;
