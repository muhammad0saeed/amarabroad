import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientMessages } from "@/components/layout/ClientMessages";
import { NewsList } from "@/components/news/NewsList";
import { PageHeader } from "@/components/ui/primitives";
import { listCountries } from "@/lib/data";
import { initPage, type LocaleParams } from "@/lib/server";
import { listNews } from "@/lib/supabase/news";

// The news robot runs every few hours; the page is rebuilt at most every 10 minutes.
export const revalidate = 600;

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "news" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function NewsPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const t = await getTranslations("news");
  const [items, countries] = await Promise.all([listNews(), listCountries()]);
  const countryNames = Object.fromEntries(countries.map((c) => [c.slug, locale === "bn" ? c.name_bn : c.name_en]));
  return (
    <ClientMessages namespaces={["news", "common"]}>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <NewsList items={items} countryNames={countryNames} />
      <p className="mt-6 max-w-[70ch] text-meta text-ink-muted">{t("rules")}</p>
    </ClientMessages>
  );
}
