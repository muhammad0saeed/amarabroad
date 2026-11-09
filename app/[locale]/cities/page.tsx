import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BrowseHeader, LinkChips } from "@/components/explore/BrowseHeader";
import { PlaceCard } from "@/components/place/PlaceCard";
import { listCities, listCountries, listUniversities } from "@/lib/data";
import { localizeDigits } from "@/lib/localize";
import { formatBDT } from "@/lib/money";
import { getCatalogue } from "@/lib/search";
import { lowestTotal, type ProgramSummary } from "@/lib/summary";
import { initPage } from "@/lib/server";
import { cityHref } from "@/lib/places";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ country?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "browse" });
  return { title: t("citiesTitle") };
}

export default async function CitiesPage({ params, searchParams }: Props) {
  const locale = await initPage(params);
  const t = await getTranslations("browse");
  const { country } = await searchParams;
  const [countries, allCities, universities, programs] = await Promise.all([listCountries(), listCities(), listUniversities(), getCatalogue()]);

  // Only cities that have programs. The database also holds every city the robot will search later
  // (2,000+); drawing all of them made this page 8 MB and froze slower computers.
  const byCity = new Map<string, ProgramSummary[]>();
  for (const p of programs) (byCity.get(p.city.slug) ?? byCity.set(p.city.slug, []).get(p.city.slug)!).push(p);
  const unisByCity = new Map<string, number>();
  for (const u of universities) unisByCity.set(u.city, (unisByCity.get(u.city) ?? 0) + 1);
  const cities = allCities.filter((c) => byCity.has(c.slug)).sort((a, b) => byCity.get(b.slug)!.length - byCity.get(a.slug)!.length);
  const withCities = countries
    .map((c) => ({ country: c, cities: cities.filter((x) => x.country === c.slug) }))
    .filter((x) => x.cities.length > 0)
    .sort((a, b) => b.cities.length - a.cities.length);
  const shown = withCities.filter((x) => !country || x.country.slug === country);

  const name = (x: { name_en: string; name_bn: string }) => (locale === "bn" ? x.name_bn : x.name_en);
  const n = (v: number) => localizeDigits(String(v), locale);
  const base = `/${locale}/cities/`;

  return (
    <>
      <BrowseHeader tab="cities" title={t("citiesTitle")} subtitle={t("citiesSubtitle")}>
        <LinkChips
          label={t("countriesTitle")}
          items={[
            { href: base, label: t("all"), active: !country, count: n(cities.length) },
            ...withCities.map(({ country: c, cities: list }) => ({
              href: `${base}?country=${c.slug}`,
              label: name(c),
              active: country === c.slug,
              count: n(list.length),
            })),
          ]}
        />
      </BrowseHeader>

      <div className="mt-6 space-y-8">
        {shown.map(({ country: c, cities: list }) => (
          <section key={c.slug} aria-labelledby={`country-${c.slug}`}>
            <h2 id={`country-${c.slug}`} className="mb-3 text-heading font-semibold">
              {name(c)}
            </h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((city) => {
                const inCity = byCity.get(city.slug)!;
                const lowest = lowestTotal(inCity);
                return (
                  <li key={city.slug}>
                    <PlaceCard
                      href={cityHref(city)}
                      title={name(city)}
                      subtitle={name(c)}
                      photo={city.photo}
                      stats={[
                        t("programs", { count: inCity.length }),
                        t("universities", { count: unisByCity.get(city.slug) ?? 0 }),
                        ...(lowest !== null ? [t("from", { amount: formatBDT(lowest, locale) })] : []),
                      ]}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
