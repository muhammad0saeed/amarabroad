import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BrowseHeader, LinkChips } from "@/components/explore/BrowseHeader";
import { PlaceCard } from "@/components/place/PlaceCard";
import { listCities, listCountries, listUniversities } from "@/lib/data";
import { localizeDigits } from "@/lib/localize";
import { formatBDT } from "@/lib/money";
import { getCatalogue } from "@/lib/search";
import { lowestTotal } from "@/lib/summary";
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
  const [countries, cities, universities, programs] = await Promise.all([listCountries(), listCities(), listUniversities(), getCatalogue()]);
  const shown = countries.filter((c) => !country || c.slug === country);
  const name = (x: { name_en: string; name_bn: string }) => (locale === "bn" ? x.name_bn : x.name_en);
  const base = `/${locale}/cities/`;

  return (
    <>
      <BrowseHeader tab="cities" title={t("citiesTitle")} subtitle={t("citiesSubtitle")}>
        <LinkChips
          label={t("countriesTitle")}
          items={[
            { href: base, label: t("all"), active: !country, count: localizeDigits(String(cities.length), locale) },
            ...countries.map((c) => ({
              href: `${base}?country=${c.slug}`,
              label: name(c),
              active: country === c.slug,
              count: localizeDigits(String(cities.filter((x) => x.country === c.slug).length), locale),
            })),
          ]}
        />
      </BrowseHeader>

      <div className="mt-6 space-y-8">
        {shown.map((c) => (
          <section key={c.slug} aria-labelledby={`country-${c.slug}`}>
            <h2 id={`country-${c.slug}`} className="mb-3 text-heading font-semibold">
              {name(c)}
            </h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cities
                .filter((x) => x.country === c.slug)
                .map((city) => {
                  const inCity = programs.filter((p) => p.city.slug === city.slug);
                  return (
                    <li key={city.slug}>
                      <PlaceCard
                        href={cityHref(city)}
                        title={name(city)}
                        subtitle={name(c)}
                        photo={city.photo}
                        stats={[
                          t("programs", { count: inCity.length }),
                          t("universities", { count: universities.filter((u) => u.city === city.slug).length }),
                          ...(lowestTotal(inCity) !== null ? [t("from", { amount: formatBDT(lowestTotal(inCity)!, locale) })] : []),
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
