import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/icons";
import { Badge, ButtonLink, Card, ExternalLink, Fact, PageHeader, Section } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { monthlyLivingCost } from "@/lib/cost";
import { getCountry, listCities, listCountries, listScholarshipsForCountry, listUniversities } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { localizeDigits, pick } from "@/lib/localize";
import { formatBDT, toBDT } from "@/lib/money";
import { getRates, initPage } from "@/lib/server";

type Props = { params: Promise<{ locale: string; slug: string }> };
export const dynamicParams = false;

export async function generateStaticParams() {
  const countries = await listCountries();
  return routing.locales.flatMap((locale) => countries.map((c) => ({ locale, slug: c.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCountry((await params).slug);
  return c ? { title: c.name_en, description: c.overview_en } : {};
}

export default async function CountryPage({ params }: Props) {
  const locale = await initPage(params);
  const country = await getCountry((await params).slug);
  if (!country) notFound();
  const t = await getTranslations("country");
  const common = await getTranslations("common");
  const labels = await getTranslations("labels");
  const rates = await getRates();
  const cities = await listCities({ country: country.slug });
  const universities = await listUniversities({ country: country.slug });
  const scholarships = await listScholarshipsForCountry(country.slug);
  const name = locale === "bn" ? country.name_bn : country.name_en;

  return (
    <div className="space-y-6 pb-4">
      <PageHeader
        title={t("title", { country: name })}
        eyebrow={
          <>
            <Badge icon="clock">{common("verifiedOn", { date: formatDate(country.last_verified, locale) })}</Badge>
          </>
        }
        subtitle={pick(country, "overview", locale)}
      >
        <ButtonLink href={`/programs?country=${country.slug}`} className="mt-4" size="sm">
          {t("seePrograms", { country: name })} <Icon name="arrowRight" className="size-4" />
        </ButtonLink>
      </PageHeader>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label={t("universities")} value={localizeDigits(String(universities.length), locale)} />
        <Fact label={t("cities")} value={localizeDigits(String(cities.length), locale)} />
        <Fact label={t("workHours")} value={t("hoursPerWeek", { hours: localizeDigits(String(country.student_work_hours), locale) })} />
        <Fact label={t("currency")} value={country.currency} hint={country.eu_member ? t("euMember") : undefined} />
      </dl>

      <Section title={t("educationTitle")}>
        <Card>
          <p>{pick(country, "education_system", locale)}</p>
        </Card>
      </Section>

      <Section title={t("postStudyTitle")}>
        <Card>
          <p>{pick(country, "post_study_work", locale)}</p>
        </Card>
      </Section>

      <Section title={t("visaTitle")}>
        <Card className="space-y-2">
          <p>{pick(country, "visa_info", locale)}</p>
          <p className="text-meta text-ink-muted">{t("visaNote")}</p>
          <div className="flex flex-wrap gap-x-4">
            <ExternalLink href={country.visa_info_url}>{t("visaLink")}</ExternalLink>
            <ExternalLink href={country.embassy_url}>{t("embassyLink")}</ExternalLink>
          </div>
        </Card>
      </Section>

      <Section title={t("citiesTitle")}>
        <ul className="grid gap-3 sm:grid-cols-2">
          {cities.map((c) => (
            <li key={c.slug}>
              <Link href={`/cities/${c.slug}`} className="block rounded-card bg-surface p-4 shadow-card hover:underline">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-heading font-semibold">{locale === "bn" ? c.name_bn : c.name_en}</span>
                  <Icon name="chevronRight" className="text-ink-muted" />
                </span>
                {monthlyLivingCost(c) !== null && (
                  <span className="mt-1 block text-meta text-ink-muted">
                    {t("livingFrom", { amount: formatBDT(toBDT(monthlyLivingCost(c)!, country.currency, rates), locale) })}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("scholarshipsTitle")}>
        <ul className="space-y-2">
          {scholarships.map((s) => (
            <li key={s.slug}>
              <Link href={`/scholarships/${s.slug}`} className="flex min-h-tap flex-wrap items-center justify-between gap-2 rounded-card bg-surface p-4 font-semibold shadow-card hover:underline">
                {s.name}
                <span className="flex gap-1.5">
                  <Badge>{labels(`scholarshipType.${s.type}`)}</Badge>
                  {!s.bd_eligible && <Badge tone="danger">{common("notForBd")}</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
