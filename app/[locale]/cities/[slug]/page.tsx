import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/icons";
import { NotFound } from "@/components/ui/NotFound";
import { Badge, Breadcrumbs, Card, ExternalLink, Fact, IconTile, PageHeader, Section } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { monthlyLivingCost } from "@/lib/cost";
import { DATA_SOURCE, getCity, getCountry, listCities, listUniversities, hasGuide } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { bilingual, localizeDigits, pick } from "@/lib/localize";
import { formatBDT, formatIndianInteger, formatMoney, toBDT } from "@/lib/money";
import { getRates, initPage } from "@/lib/server";

type Props = { params: Promise<{ locale: string; slug: string }> };
// Live data: pages are made on first visit and kept for 10 minutes. Sample data: all made at build time.
export const dynamicParams = true;
export const revalidate = 600;

export async function generateStaticParams() {
  if (DATA_SOURCE === "supabase") return [];
  const cities = await listCities();
  return routing.locales.flatMap((locale) => cities.map((c) => ({ locale, slug: c.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCity((await params).slug);
  return c ? { title: c.name_en, description: c.overview_en } : {};
}

export default async function CityPage({ params }: Props) {
  const locale = await initPage(params);
  const city = await getCity((await params).slug);
  // A city the robot created but whose guide isn't written yet has no page of its own.
  if (!city || !hasGuide(city)) notFound();
  const country = (await getCountry(city.country))!;
  const t = await getTranslations("city");
  const common = await getTranslations("common");
  const labels = await getTranslations("labels");
  const rates = await getRates();
  const universities = await listUniversities({ city: city.slug });
  const cur = country.currency;
  // Unknown amounts (guide not written yet) show "Not found", never a zero.
  const bdt = (amount: number | null) => (amount === null ? <NotFound /> : formatBDT(toBDT(amount, cur, rates), locale));
  const local = (amount: number | null) => (amount === null ? undefined : formatMoney(amount, cur, locale));
  const cityName = locale === "bn" ? city.name_bn : city.name_en;
  const countryName = locale === "bn" ? country.name_bn : country.name_en;

  const rows: [string, number | null][] = [
    [t("rentShared"), city.cost_rent_shared],
    [t("food"), city.cost_food],
    [t("transport"), city.cost_transport],
    [t("phone"), city.cost_phone],
    [t("insurance"), city.cost_insurance],
  ];

  return (
    <div className="space-y-6 pb-4">
      <div className="pt-2">
        <Breadcrumbs label={common("breadcrumb")} items={[{ href: `/countries/${country.slug}`, label: countryName }, { label: cityName }]} />
        <PageHeader
          title={t("title", { city: cityName })}
          eyebrow={
            <>
              <Badge icon="clock">{common("verifiedOn", { date: formatDate(city.last_verified, locale) })}</Badge>
            </>
          }
          subtitle={pick(city, "overview", locale)}
        />
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label={t("monthlyShared")} value={bdt(monthlyLivingCost(city, "shared"))} hint={local(monthlyLivingCost(city, "shared"))} />
        <Fact label={t("monthlyStudio")} value={bdt(monthlyLivingCost(city, "studio"))} hint={local(monthlyLivingCost(city, "studio"))} />
        <Fact label={t("students")} value={city.population_students === null ? <NotFound /> : localizeDigits(formatIndianInteger(city.population_students), locale)} />
        <Fact label={t("workHours")} value={country.student_work_hours === null ? <NotFound /> : t("hoursPerWeek", { hours: localizeDigits(String(country.student_work_hours), locale) })} />
      </dl>

      <Section title={t("costTitle")}>
        <Card>
          <table className="w-full text-meta">
            <caption className="sr-only">{t("costTitle")}</caption>
            <thead>
              <tr className="text-ink-muted">
                <th scope="col" className="pb-2 text-left font-normal">
                  {t("item")}
                </th>
                <th scope="col" className="pb-2 text-right font-normal">
                  {t("perMonth")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(([label, amount]) => (
                <tr key={label}>
                  <th scope="row" className="py-2 text-left font-normal">
                    {label}
                  </th>
                  <td className="py-2 text-right">
                    <span className="font-semibold">{bdt(amount)}</span>
                    {amount !== null && <span className="block text-ink-muted">{local(amount)}</span>}
                  </td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="py-2 text-left font-semibold">
                  {t("total")}
                </th>
                <td className="py-2 text-right text-body font-bold">{bdt(monthlyLivingCost(city))}</td>
              </tr>
            </tbody>
          </table>
          {city.cost_rent_studio !== null && <p className="mt-3 text-meta text-ink-muted">{t("studioNote", { amount: formatBDT(toBDT(city.cost_rent_studio, cur, rates), locale) })}</p>}
        </Card>
      </Section>

      <Section title={t("workTitle")}>
        <Card className="space-y-3">
          <p>{pick(country, "student_work_note", locale)}</p>
          <p>
            <span className="font-semibold">{t("minWage")}: </span>
            {country.min_wage === null ? t("noMinWage") : t("minWageValue", { amount: formatMoney(country.min_wage, cur, locale), bdt: formatBDT(toBDT(country.min_wage, cur, rates), locale) })}
          </p>
          <p className="text-meta text-ink-muted">{pick(country, "min_wage_note", locale)}</p>
          <div>
            <h3 className="font-semibold">{t("languageForJobs")}</h3>
            <Badge tone={city.local_language_needed_for_jobs === "not_needed" ? "success" : city.local_language_needed_for_jobs === "helpful" ? "warning" : "danger"} className="mt-1">
              {labels(`languageNeed.${city.local_language_needed_for_jobs}`)}
            </Badge>
            <p className="mt-1 text-meta text-ink-muted">{pick(city, "local_language_note", locale)}</p>
          </div>
          <div>
            <h3 className="font-semibold">{t("commonJobs")}</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {city.common_student_jobs.map((j) => (
                <li key={j.en}>
                  <Badge>{bilingual(j, locale)}</Badge>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold">{t("searchJobs")}</h3>
            <p className="text-meta text-ink-muted">{t("searchJobsNote")}</p>
            <div className="mt-1 flex flex-wrap gap-x-4">
              {city.job_search_links.map((l) => (
                <ExternalLink key={l.url} href={l.url}>
                  {l.label}
                </ExternalLink>
              ))}
            </div>
          </div>
        </Card>
      </Section>

      <Section title={t("communityTitle")}>
        <Card className="flex gap-3">
          <span className="lite:hidden">
            <IconTile tile="green" icon="users" size="sm" />
          </span>
          <p>{pick(city, "bd_community_note", locale)}</p>
        </Card>
      </Section>

      <Section title={t("universities", { city: cityName })}>
        <ul className="space-y-2">
          {universities.map((u) => (
            <li key={u.slug}>
              <Link href={`/universities/${u.slug}`} className="flex min-h-tap items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-card hover:underline">
                <span className="flex items-center gap-3">
                  <span className="lite:hidden">
                    <IconTile tile="indigo" icon="building" size="sm" />
                  </span>
                  <span>
                    <span className="block font-semibold">{u.name}</span>
                    <span className="text-meta text-ink-muted">{labels(`universityType.${u.type}`)}</span>
                  </span>
                </span>
                <Icon name="chevronRight" className="text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
