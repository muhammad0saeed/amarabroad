import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseSecretKey, supabaseUrl } from "./env";

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Reads published content with no user session (at build time and when pages refresh). Row-level security applies. */
export function publicClient() {
  return createClient(supabaseUrl(), supabasePublishableKey(), noSession);
}

/**
 * Bypasses row-level security. Use only in server code that has already checked the request
 * (form submissions after the Turnstile check). Never import it from a Client Component.
 */
export function serviceClient() {
  return createClient(supabaseUrl(), supabaseSecretKey(), noSession);
}

/** The signed-in admin's session, read from cookies, for /admin pages and actions. Row-level security applies. */
export async function sessionClient() {
  const store = await cookies();
  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server Components can't set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}
