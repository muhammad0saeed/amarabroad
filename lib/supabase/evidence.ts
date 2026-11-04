import "server-only";

// Where the robot's facts came from, and the page search. Server-only (secret key):
// field_changes and page snapshots are never exposed to browsers directly.

import { serviceClient } from "./clients";

export interface Evidence {
  /** The words on the official page the value was read from. */
  quote: string;
  url: string;
  /** When the robot applied it (YYYY-MM-DD). */
  date: string;
}

/** The latest applied evidence for each field of a program (fields the robot didn't read are absent). */
export async function getEvidence(programSlug: string): Promise<Record<string, Evidence>> {
  const { data, error } = await serviceClient()
    .from("field_changes")
    .select("field, evidence, source_url, decided_at, created_at")
    .eq("entity_type", "program")
    .eq("entity_slug", programSlug)
    .eq("status", "applied")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return {};
  const out: Record<string, Evidence> = {};
  for (const row of data as { field: string; evidence: string | null; source_url: string | null; decided_at: string | null; created_at: string }[]) {
    // Newest first, so the first one per field wins. "(…)" notes are the robot's own judgement, not quotes.
    if (out[row.field] || !row.evidence || row.evidence.startsWith("(") || !row.source_url) continue;
    out[row.field] = { quote: row.evidence, url: row.source_url, date: (row.decided_at ?? row.created_at).slice(0, 10) };
  }
  return out;
}

export interface PageHit {
  program: string;
  url: string;
  /** Matching words marked «like this». */
  snippet: string;
}

/** Full-text search over what every published program's official page says (any language). */
export async function searchPages(q: string, max = 100): Promise<PageHit[]> {
  if (q.trim().length < 2) return [];
  const { data, error } = await serviceClient().rpc("search_program_pages", { q, max_results: max });
  if (error || !data) return [];
  return (data as { program: string; url: string; snippet: string }[]).map(({ program, url, snippet }) => ({ program, url, snippet }));
}
