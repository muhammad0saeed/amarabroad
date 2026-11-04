import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProgramCard } from "@/components/program/ProgramCard";
import { Badge, Breadcrumbs, Card, ExternalLink, Fact, PageHeader, Section, YesNoTag } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCity, getCountry, getUniversity, listScholarshipsForUniversity, listUniversities } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { isFallback, localizeDigits, pick } from "@/lib/localize";
import { getFieldInfo, getSummaries, initPage } from "@/lib/server";

type Props = { params: Promise<{ locale: string; slug: string }> };
export const dynamicParams = false;

export async function generateStaticParams() {
  const universities = await listUniversities();
  return routing.locales.flatMap((locale) => universities.map((u) => ({ locale, slug: u.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const u = await getUniversity((await params).slug);
  return u ? { title: u.name, description: u.overview_en } : {};
}

export default async function UniversityPage({ params }: Props) {
  const locale = await initPage(params);
  const u = await getUniversity((await params).slug);
  if (!u) notFound();
  const city = (await getCity(u.city))!;
  const country = (await getCountry(city.country))!;
  const t = await getTranslations("university");
  const common = await getTranslations("common");
  const labels = await getTranslations("labels");
  const programs = (await getSummaries()).filter((p) => p.university.slug === u.slug);
  const scholarships = await listScholarshipsForUniversity(u.slug);
  const fields = await getFieldInfo();
  const cityName = locale === "bn" ? city.name_bn : city.name_en;
  const countryName = locale === "bn" ? country.name_bn : country.name_en;

  return (
    <div className="space-y-6 pb-4">
      <div className="pt-2">
        <Breadcrumbs
          label={common("breadcrumb")}
          items={[
            { href: `/countries/${country.slug}`, label: countryName },
            { href: `/cities/${city.slug}`, label: cityName },
            { label: u.name },
          ]}
        />
        <PageHeader
          title={u.name}
          eyebrow={
            <>
              <Badge tone="primary">{labels(`universityType.${u.type}`)}</Badge>
              <Badge icon="clock">{common("verifiedOn", { date: formatDate(u.last_verified, locale) })}</Badge>
            </>
          }
          subtitle={pick(u, "overview", locale)}
        >
          {isFallback(u, "overview", locale) && <p className="mt-1 text-meta text-ink-muted">{common("englishOnly")}</p>}
        </PageHeader>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact
          label={t("city")}
          value={
            <Link href={`/cities/${city.slug}`} className="text-primary-ink hover:underline">
              {cityName}
            </Link>
          }
          hint={countryName}
        />
        <Fact label={t("type")} value={labels(`universityType.${u.type}`)} />
        <Fact label={t("ranking")} value={u.ranking ? `#${localizeDigits(u.ranking.rank, locale)}` : t("notRanked")} hint={u.ranking ? `${u.ranking.source}, ${localizeDigits(String(u.ranking.year), locale)}` : undefined} />
        <Fact label={t("programs")} value={localizeDigits(String(programs.length), locale)} />
      </dl>

      <Card className="space-y-3">
        <h2 className="text-heading font-semibold">{t("quality")}</h2>
        <p className="text-meta text-ink-muted">{u.accreditation}</p>
        <div className="flex flex-wrap gap-2">
          <YesNoTag yes={u.eu_recognised}>{t("euRecognised")}</YesNoTag>
          <YesNoTag yes={u.ects}>{t("ects")}</YesNoTag>
        </div>
        <div className="flex flex-wrap gap-x-4">
          {u.ranking && <ExternalLink href={u.ranking.url}>{t("rankingSource")}</ExternalLink>}
          <ExternalLink href={u.website}>{t("website")}</ExternalLink>
        </div>
        <p className="text-meta text-ink-muted">{t("rankingNote")}</p>
      </Card>

      <Section title={t("programsTitle")}>
        <ul className="grid gap-3 md:grid-cols-2">
          {programs.map((p) => (
            <li key={p.slug}>
              <ProgramCard program={p} field={fields[p.field]} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("scholarships")}>
        {scholarships.length === 0 ? (
          <p className="text-ink-muted">{t("noScholarships")}</p>
        ) : (
          <ul className="space-y-2">
            {scholarships.map((s) => (
              <li key={s.slug}>
                <Link href={`/scholarships/${s.slug}`} className="flex min-h-tap items-center justify-between gap-2 rounded-card bg-surface p-4 font-semibold shadow-card hover:underline">
                  {s.name} <Badge>{labels(`scholarshipType.${s.type}`)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
