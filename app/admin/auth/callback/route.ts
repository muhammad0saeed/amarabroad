import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { siteOrigin } from "@/lib/admin/origin";
import { sessionClient } from "@/lib/supabase/clients";

// The link in the sign-in email lands here and becomes the login cookie. Two kinds of link:
//  - ?token_hash=…&type=… (our email template): works in any browser, e.g. Gmail on your phone.
//  - ?code=… (Supabase's default template): only works in the browser that asked for the link.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = siteOrigin(request.headers);
  const to = (path: string) => NextResponse.redirect(new URL(path, origin));
  const db = await sessionClient();

  const tokenHash = params.get("token_hash");
  const code = params.get("code");
  if (tokenHash) {
    const type = (params.get("type") ?? "email") as EmailOtpType;
    const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) console.error("sign-in link failed:", error.message);
    return to(error ? "/admin/login/?error=link" : "/admin/");
  }
  if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return to("/admin/");
    console.error("sign-in link failed:", error.name, error.message);
    // The browser that asked for the link keeps a secret the link needs; another browser doesn't have it.
    return to(/verifier/i.test(`${error.name} ${error.message}`) ? "/admin/login/?error=browser" : "/admin/login/?error=link");
  }
  return to("/admin/login/?error=link");
}
