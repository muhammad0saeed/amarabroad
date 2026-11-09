/* eslint-disable @next/next/no-img-element -- photos are pre-sized WebP files */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/primitives";
import { listCities, listCountries } from "@/lib/data";
import { initPage, type LocaleParams } from "@/lib/server";

// Photo credits: Creative Commons photos must name their photographer and licence wherever they're used.
export const revalidate = 600;

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "credits" });
  return { title: t("title") };
}

export default async function CreditsPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const t = await getTranslations("credits");
  const places = [...(await listCountries()), ...(await listCities())].filter((p) => p.photo);
  const name = (p: { name_en: string; name_bn: string }) => (locale === "bn" ? p.name_bn : p.name_en);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {places
          .sort((a, b) => name(a).localeCompare(name(b)))
          .map((p) => (
            <li key={p.slug} className="flex gap-3 rounded-card bg-surface p-3 shadow-card">
              <img src={p.photo!.src} alt="" width={96} height={64} loading="lazy" className="h-16 w-24 shrink-0 rounded-tile object-cover" />
              <div className="min-w-0 text-meta">
                <p className="font-semibold text-ink">{name(p)}</p>
                <a href={p.photo!.source_url} target="_blank" rel="noopener noreferrer" className="break-words text-ink-muted underline">
                  {p.photo!.credit}
                </a>
              </div>
            </li>
          ))}
      </ul>
      <p className="mt-6 max-w-[70ch] text-meta text-ink-muted">{t("note")}</p>
    </>
  );
}
