import "server-only";

// Who may use /admin: a signed-in Supabase user whose email is in public.admins.
// Pages call requireAdmin(); actions call it too, so nothing in /admin works for anyone else.
// All admin reads and writes go through the signed-in session, so row-level security applies.

import { redirect } from "next/navigation";
import { sessionClient } from "@/lib/supabase/clients";

export async function currentAdmin(): Promise<{ email: string; db: Awaited<ReturnType<typeof sessionClient>> } | null> {
  const db = await sessionClient();
  const { data } = await db.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  if (!email) return null;
  // RLS lets only admins read public.admins, so a row back means "is an admin".
  const { data: row } = await db.from("admins").select("email").eq("email", email).maybeSingle();
  return row ? { email, db } : null;
}

export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login/");
  return admin;
}
