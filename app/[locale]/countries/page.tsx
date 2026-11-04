import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BrowseHeader } from "@/components/explore/BrowseHeader";
import { PlaceCard } from "@/components/place/PlaceCard";
import { listCities, listCountries, listUniversities } from "@/lib/data";
import { formatBDT } from "@/lib/money";
import { getCatalogue } from "@/lib/search";
import { lowestTotal } from "@/lib/summary";
import { initPage, type LocaleParams } from "@/lib/server";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "browse" });
  return { title: t("countriesTitle") };
}

export default async function CountriesPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const t = await getTranslations("browse");
  const [countries, cities, universities, programs] = await Promise.all([listCountries(), listCities(), listUniversities(), getCatalogue()]);
  const cityCountry = Object.fromEntries(cities.map((c) => [c.slug, c.country]));

  return (
    <>
      <BrowseHeader tab="countries" title={t("countriesTitle")} subtitle={t("countriesSubtitle")} />
      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((c) => {
          const inCountry = programs.filter((p) => p.country.slug === c.slug);
          const unis = universities.filter((u) => cityCountry[u.city] === c.slug).length;
          const cityNames = cities.filter((x) => x.country === c.slug).map((x) => (locale === "bn" ? x.name_bn : x.name_en));
          return (
            <li key={c.slug}>
              <PlaceCard
                size="lg"
                href={`/countries/${c.slug}`}
                title={locale === "bn" ? c.name_bn : c.name_en}
                subtitle={cityNames.join(" · ")}
                photo={c.photo}
                stats={[
                  t("programs", { count: inCountry.length }),
                  t("universities", { count: unis }),
                  ...(lowestTotal(inCountry) !== null ? [t("from", { amount: formatBDT(lowestTotal(inCountry)!, locale) })] : []),
                ]}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}
