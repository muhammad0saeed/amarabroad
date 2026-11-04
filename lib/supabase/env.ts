import "server-only";

// Supabase settings come from .env.local (locally) or Vercel's environment variables.
// None of them is exposed to the browser: the browser never talks to Supabase directly.
// The Vercel ⇄ Supabase integration adds its own names (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, …),
// so each setting accepts those too.

function first(names: string[]): string | undefined {
  for (const name of names) if (process.env[name]) return process.env[name];
  return undefined;
}

function required(names: string[]): string {
  const value = first(names);
  if (!value) throw new Error(`Missing ${names[0]}. Copy .env.local.example to .env.local and fill it in (see README).`);
  return value;
}

const URL_NAMES = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"];
const PUBLISHABLE_NAMES = ["SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const SECRET_NAMES = ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

export const supabaseUrl = () => required(URL_NAMES);
/** Safe to share: it can only do what the database's row-level security allows. */
export const supabasePublishableKey = () => required(PUBLISHABLE_NAMES);
/** Bypasses row-level security. Server-only, never in git or the browser. */
export const supabaseSecretKey = () => required(SECRET_NAMES);

export const hasSupabase = () => Boolean(first(URL_NAMES) && first(PUBLISHABLE_NAMES));
export const hasSupabaseSecret = () => Boolean(first(SECRET_NAMES));
