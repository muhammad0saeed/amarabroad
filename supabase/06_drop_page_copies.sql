-- amarAbroad: stop keeping whole copies of university pages (applied to the live project on 2026-11-08).
--
-- Why: the copies (text + full-text index) took ~290 MB of the free plan's 500 MB, and 49,000 more pages
-- were waiting. Searching inside them was also what made the program search take 10-40 seconds.
-- The robot still reads every page and keeps every fact with its quote (field_changes); only the
-- whole-page text is gone. page_snapshots keeps one fingerprint row per page (content_hash), which
-- the readings (extractions) point to.
--
-- Afterwards, run separately (it can't run inside a transaction) to give the space back:
--   vacuum full public.page_snapshots;

drop function if exists public.search_program_pages(text, integer);
drop index if exists public.page_snapshots_tsv_idx;
alter table public.page_snapshots drop column if exists tsv;
alter table public.page_snapshots alter column text_content set default '';
update public.page_snapshots set text_content = '' where text_content <> '';
