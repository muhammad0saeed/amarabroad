-- The program list is read without OFFSET: lib/supabase/catalog.ts reads lanes of slugs, each request
-- continuing after the last slug ("slug > last"), using this index. With OFFSET, page 8 (OFFSET 7000) went over
-- the database's 8-second limit while the robots kept it busy and failed deploys.
-- catalog_slug_bounds is no longer used by the site (it was too slow under load). Run after 17_country_guides_content.sql.

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
