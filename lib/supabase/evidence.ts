import "server-only";

// Where the robot's facts came from. Server-only (secret key): field_changes is never exposed to browsers directly.

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
    .limit(200)
    .abortSignal(AbortSignal.timeout(3000));
  if (error || !data) return {};
  const out: Record<string, Evidence> = {};
  for (const row of data as { field: string; evidence: string | null; source_url: string | null; decided_at: string | null; created_at: string }[]) {
    // Newest first, so the first one per field wins. "(…)" notes are the robot's own judgement, not quotes.
    if (out[row.field] || !row.evidence || row.evidence.startsWith("(") || !row.source_url) continue;
    out[row.field] = { quote: row.evidence, url: row.source_url, date: (row.decided_at ?? row.created_at).slice(0, 10) };
  }
  return out;
}

export interface UniversityFact {
  field: "tuition" | "application_fee" | "english" | "deadline" | "document";
  /** null: the page is about both levels. */
  level: "bachelor" | "master" | null;
  value: Record<string, unknown>;
  quote: string;
  source_url: string;
  checked_at: string;
}

/** What a university's general pages say (fees, English scores, deadlines, documents), from the gap-filler robot. */
export async function getUniversityFacts(university: string): Promise<UniversityFact[]> {
  const { data, error } = await serviceClient()
    .from("university_facts")
    .select("field, level, value, quote, source_url, checked_at")
    .eq("university", university)
    .limit(100)
    .abortSignal(AbortSignal.timeout(3000));
  if (error || !data) return [];
  return data as UniversityFact[];
}
