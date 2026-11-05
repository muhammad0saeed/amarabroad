import { NextResponse, type NextRequest } from "next/server";
import { sessionClient } from "@/lib/supabase/clients";

// The link in the sign-in email lands here with a one-time code, which becomes the login cookie.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));
  if (!code) return to("/admin/login/?error=link");
  const db = await sessionClient();
  const { error } = await db.auth.exchangeCodeForSession(code);
  return to(error ? "/admin/login/?error=link" : "/admin/");
}
