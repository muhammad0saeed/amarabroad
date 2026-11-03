import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { inter, notoBengali } from "../fonts";
import { CompareTray } from "@/components/compare/CompareTray";
import { ClientMessages } from "@/components/layout/ClientMessages";
import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { routing } from "@/i18n/routing";
import { themeScript } from "@/lib/inlineScripts";
import { site } from "@/lib/site";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: { default: site.name, template: `%s · ${site.name}` },
    description: t("description"),
    // Private preview: keep it out of search engines until launch.
    robots: { index: false, follow: false },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("header");

  return (
    <html lang={locale} className={`${inter.variable} ${notoBengali.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:shadow-float"
        >
          {t("skipToContent")}
        </a>
        {/* Shell text only; each route's layout adds the text its own client components need. */}
        <ClientMessages namespaces={[]}>
          <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
            <Header />
            <main id="main" className="flex-1 px-4">
              {children}
            </main>
            <Footer />
          </div>
          <CompareTray />
          <BottomNav />
        </ClientMessages>
      </body>
    </html>
  );
}
