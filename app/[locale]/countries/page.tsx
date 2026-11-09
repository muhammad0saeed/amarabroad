import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BrowseHeader } from "@/components/explore/BrowseHeader";
import { PlaceCard } from "@/components/place/PlaceCard";
import { listCities, listCountries, listUniversities } from "@/lib/data";
import { formatBDT } from "@/lib/money";
import { getCatalogue } from "@/lib/search";
import { lowestTotal } from "@/lib/summary";
import { initPage, type LocaleParams } from "@/lib/server";
import { countryHref } from "@/lib/places";

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
        {[...countries].sort((a, b) => programs.filter((p) => p.country.slug === b.slug).length - programs.filter((p) => p.country.slug === a.slug).length).map((c) => {
          const inCountry = programs.filter((p) => p.country.slug === c.slug);
          const unis = universities.filter((u) => cityCountry[u.city] === c.slug).length;
          // Only cities that have programs, up to 6 (the database also holds every city the robot will search later).
          const withPrograms = new Set(inCountry.map((p) => p.city.slug));
          const names = cities.filter((x) => x.country === c.slug && withPrograms.has(x.slug)).map((x) => (locale === "bn" ? x.name_bn : x.name_en));
          const cityNames = names.length > 6 ? [...names.slice(0, 6), `+${names.length - 6}`] : names;
          return (
            <li key={c.slug}>
              <PlaceCard
                size="lg"
                href={countryHref(c)}
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
