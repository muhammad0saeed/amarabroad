-- amarAbroad database, part 2 of 3: who can read and write what (row-level security).
-- Paste into Supabase → SQL Editor → New query → Run, after 01_schema.sql. Safe to run again.
--
--   Content tables   anyone may read published rows; only admins write.
--   Visitor reports  nobody reads or writes through the public key; the server inserts them with the
--                    secret key (which bypasses RLS) after checking Turnstile; admins read and update.
--   Robot tables     server only (secret key); admins may read and decide on held changes.
--   admins           admins may read the list; it's changed only here in the SQL Editor.

-- An admin is a signed-in user whose (verified) email is in public.admins.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

do $$
declare t text;
begin
  -- Content: public read of published rows, admin write.
  foreach t in array array['fields','degree_mappings','exchange_rates','glossary_terms','countries','cities','universities','programs','scholarships']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "read published" on public.%I', t);
    execute format('create policy "read published" on public.%I for select to anon, authenticated using (published or public.is_admin())', t);
    execute format('drop policy if exists "admins write" on public.%I', t);
    execute format('create policy "admins write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;

  -- Reports and robot tables: admins only (the server uses the secret key, which skips RLS).
  foreach t in array array['wrong_info_reports','problem_reports','outcome_reports','sources','page_snapshots','extractions','field_changes','crawl_runs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admins read" on public.%I', t);
    execute format('create policy "admins read" on public.%I for select to authenticated using (public.is_admin())', t);
    execute format('drop policy if exists "admins update" on public.%I', t);
    execute format('create policy "admins update" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

alter table public.admins enable row level security;
drop policy if exists "admins read" on public.admins;
create policy "admins read" on public.admins for select to authenticated using (public.is_admin());

-- Visitors never get a direct line to reports or robot data, even with the public key.
revoke insert, delete on public.wrong_info_reports, public.problem_reports, public.outcome_reports from anon, authenticated;
revoke all on public.sources, public.page_snapshots, public.extractions, public.field_changes, public.crawl_runs from anon;
revoke all on public.admins from anon;
