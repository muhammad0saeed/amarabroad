import Link from "next/link";
import { latin, notoBengali } from "./fonts";
import { themeScript } from "@/lib/inlineScripts";

// Fallback 404 for URLs outside /en and /bn (becomes out/404.html). Shown in both languages.
export default function RootNotFound() {
  return (
    <html lang="en" className={`${latin.variable} ${notoBengali.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="grid min-h-dvh place-items-center p-4">
        <main className="w-full max-w-sm rounded-card bg-surface p-6 text-center shadow-card">
          <h1 className="text-title font-bold">Page not found</h1>
          <p className="mt-1 text-ink-muted" lang="bn">
            পেজটি পাওয়া যায়নি
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link className="inline-flex min-h-tap items-center rounded-full bg-primary px-5 font-semibold text-on-primary" href="/en/">
              Home
            </Link>
            <Link className="inline-flex min-h-tap items-center rounded-full border border-border px-5 font-semibold" href="/bn/" lang="bn">
              হোম
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
