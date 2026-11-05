import type { Metadata } from "next";
import Link from "next/link";
import { latin } from "../fonts";
import { themeScript } from "@/lib/inlineScripts";
import { currentAdmin } from "@/lib/admin/auth";
import { signOut } from "./actions";

// /admin is English-only and outside the [locale] pages, so it has its own <html>.
// Signing in sets Supabase's login cookie; public pages never get one.
export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · amarAbroad" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin/", label: "Overview" },
  { href: "/admin/reports/", label: "Reports" },
  { href: "/admin/outcomes/", label: "Outcomes" },
  { href: "/admin/changes/", label: "Robot changes" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();
  return (
    <html lang="en" className={latin.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <div className="mx-auto w-full max-w-5xl px-4 pb-16">
          <header className="flex flex-wrap items-center justify-between gap-3 py-4">
            <Link href="/admin/" className="text-heading font-bold tracking-tight">
              amar<span className="text-accent">Abroad</span> <span className="text-ink-muted">admin</span>
            </Link>
            {admin && (
              <form action={signOut} className="flex items-center gap-3 text-meta">
                <span className="text-ink-muted">{admin.email}</span>
                <button className="rounded-full border border-border px-3 py-1.5 font-semibold hover:bg-surface-2">Sign out</button>
              </form>
            )}
          </header>
          {admin && (
            <nav aria-label="Admin" className="-mx-4 mb-6 overflow-x-auto px-4 no-scrollbar">
              <ul className="flex w-max gap-1 rounded-full bg-surface-2 p-1">
                {NAV.map((n) => (
                  <li key={n.href}>
                    <Link href={n.href} className="inline-flex min-h-10 items-center rounded-full px-4 text-meta font-semibold text-ink-muted hover:text-ink">
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
