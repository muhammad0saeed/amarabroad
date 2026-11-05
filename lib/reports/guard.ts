import "server-only";

// Spam protection for the report forms: Cloudflare Turnstile, a hidden trap field, and a rate limit
// (5 reports per 10 minutes per visitor). Visitors are counted by a one-way hash of their IP address;
// the address itself is never stored.

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { serviceClient } from "@/lib/supabase/clients";

export const RATE_LIMIT = { max: 5, minutes: 10 } as const;
type ReportTable = "wrong_info_reports" | "problem_reports" | "outcome_reports";

/** The visitor's IP address from the proxy headers (Vercel sets x-forwarded-for). */
async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/** One-way hash: enough to count repeat senders, useless for finding anyone. */
export async function visitorHash(): Promise<string> {
  const salt = process.env.REPORTS_SALT || process.env.SUPABASE_SECRET_KEY || "amarabroad";
  return createHash("sha256").update(`${salt}:${await clientIp()}`).digest("hex").slice(0, 32);
}

export type GuardFailure = "spam" | "rate_limited";

/**
 * Turnstile check. Without TURNSTILE_SECRET_KEY it passes only outside production (local testing),
 * so a missing key can never quietly switch spam protection off on the live site.
 */
export async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: await clientIp() });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}

export async function underRateLimit(table: ReportTable, hash: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT.minutes * 60_000).toISOString();
  const { count, error } = await serviceClient().from(table).select("id", { count: "exact", head: true }).eq("ip_hash", hash).gte("created_at", since);
  // If the count can't be read, let the report through rather than lose it.
  return error ? true : (count ?? 0) < RATE_LIMIT.max;
}

/** All checks in order; null = OK to save. `trap` is the hidden field only bots fill in. */
export async function guard(table: ReportTable, token: string | undefined, trap: string | undefined): Promise<{ failure: GuardFailure | null; hash: string }> {
  const hash = await visitorHash();
  if (trap) return { failure: "spam", hash };
  if (!(await verifyTurnstile(token))) return { failure: "spam", hash };
  if (!(await underRateLimit(table, hash))) return { failure: "rate_limited", hash };
  return { failure: null, hash };
}
