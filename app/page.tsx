import Link from "next/link";
import type { Metadata } from "next";
import { latin, notoBengali } from "./fonts";
import { localeRedirectScript } from "@/lib/inlineScripts";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: site.name,
  robots: { index: false, follow: false },
};

// "/" only picks a language and moves on (see localeRedirectScript).
export default function LanguageRedirect() {
  return (
    <html lang="en" className={`${latin.variable} ${notoBengali.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: localeRedirectScript }} />
        <noscript>
          <meta httpEquiv="refresh" content="0; url=/en/" />
        </noscript>
      </head>
      <body className="grid min-h-dvh place-items-center p-4">
        <p className="text-center text-ink-muted">
          <Link className="text-primary-ink underline" href="/en/">
            English
          </Link>
          {" · "}
          <Link className="text-primary-ink underline" href="/bn/" lang="bn">
            বাংলা
          </Link>
        </p>
      </body>
    </html>
  );
}
