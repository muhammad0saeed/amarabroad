-- amarAbroad: the cross-checker's results (lib/crosscheck.ts, robot command crosscheck): where a program's
-- own page and the university's general page agree, and where they differ enough for a person to look.
-- Applied to the live project on 2026-11-09. Rebuilt every shift; admins see conflicts in /admin.

create table if not exists public.fact_checks (
  program text not null references public.programs(slug) on delete cascade,
  field text not null check (field in ('tuition','ielts')),
  status text not null check (status in ('agree','conflict')),
  program_value numeric not null,
  general_value numeric not null,
  currency text,
  general_quote text not null,
  general_url text not null,
  checked_at timestamptz not null default now(),
  primary key (program, field)
);
create index if not exists fact_checks_conflicts_idx on public.fact_checks (status) where status = 'conflict';

alter table public.fact_checks enable row level security;
drop policy if exists "admins read" on public.fact_checks;
create policy "admins read" on public.fact_checks for select to authenticated using ((select private.is_admin()));
revoke all on public.fact_checks from anon;
