-- amarAbroad database, part 2 of 3: who can read and write what (row-level security).
-- Paste into Supabase → SQL Editor → New query → Run, after 01_schema.sql. Safe to run again.
--
--   Content tables   anyone may read published rows; only admins add, change or delete.
--   Visitor reports  nobody reads or writes through the public key; the server inserts them with the
--                    secret key (which bypasses RLS) after checking Turnstile; admins read and update.
--   Robot tables     server only (secret key); admins may read and decide on held changes.
--   admins           admins may read the list; it's changed only here in the SQL Editor.
--   Page search      called by the website's server with the secret key, not by browsers.

-- Helpers live in a schema the API doesn't publish, so they can't be called as /rpc endpoints.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- An admin is a signed-in user whose (verified) email is in public.admins.
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- "(select private.is_admin())" is worked out once per query, not once per row.
do $$
declare t text;
begin
  -- Content: public read of published rows; admins insert, update and delete.
  foreach t in array array['fields','degree_mappings','exchange_rates','glossary_terms','countries','cities','universities','programs','scholarships']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "read published" on public.%I', t);
    execute format('create policy "read published" on public.%I for select to anon, authenticated using (published or (select private.is_admin()))', t);
    execute format('drop policy if exists "admins write" on public.%I', t);
    execute format('drop policy if exists "admins insert" on public.%I', t);
    execute format('create policy "admins insert" on public.%I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('drop policy if exists "admins update" on public.%I', t);
    execute format('create policy "admins update" on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('drop policy if exists "admins delete" on public.%I', t);
    execute format('create policy "admins delete" on public.%I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;

  -- Reports and robot tables: admins only (the server uses the secret key, which skips RLS).
  foreach t in array array['wrong_info_reports','problem_reports','outcome_reports','sources','page_snapshots','extractions','field_changes','crawl_runs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admins read" on public.%I', t);
    execute format('create policy "admins read" on public.%I for select to authenticated using ((select private.is_admin()))', t);
    execute format('drop policy if exists "admins update" on public.%I', t);
    execute format('create policy "admins update" on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
  end loop;
end $$;

alter table public.admins enable row level security;
drop policy if exists "admins read" on public.admins;
create policy "admins read" on public.admins for select to authenticated using ((select private.is_admin()));

-- An earlier version kept is_admin in public; nothing uses it any more.
drop function if exists public.is_admin();

-- Page search: the website's server calls it with the secret key.
revoke all on function public.search_program_pages(text, integer) from public, anon, authenticated;
grant execute on function public.search_program_pages(text, integer) to service_role;

-- Visitors never get a direct line to reports or robot data, even with the public key.
revoke insert, delete on public.wrong_info_reports, public.problem_reports, public.outcome_reports from anon, authenticated;
revoke all on public.sources, public.page_snapshots, public.extractions, public.field_changes, public.crawl_runs from anon;
revoke all on public.admins from anon;
