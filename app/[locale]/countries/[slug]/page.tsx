/* eslint-disable @next/next/no-img-element -- photos are pre-sized WebP files */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/icons";
import { Badge, ButtonLink, Card, ExternalLink, Fact, PageHeader, Section } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { DATA_SOURCE, getCountry, listCountries, listScholarshipsForCountry, listUniversities, hasGuide, listCities } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { bilingual, localizeDigits, pick } from "@/lib/localize";
import { formatBDT, formatMoney, toBDT } from "@/lib/money";
import { getCatalogue } from "@/lib/search";
import { getRates, initPage } from "@/lib/server";

type Props = { params: Promise<{ locale: string; slug: string }> };
// Live data: pages are made on first visit and kept for 10 minutes. Sample data: all made at build time.
export const dynamicParams = true;
export const revalidate = 600;

export async function generateStaticParams() {
  if (DATA_SOURCE === "supabase") return [];
  const countries = await listCountries();
  return routing.locales.flatMap((locale) => countries.map((c) => ({ locale, slug: c.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCountry((await params).slug);
  return c ? { title: `Study in ${withThe(c.slug, c.name_en)}`, description: c.overview_en } : {};
}

/** English says "study in the UK / the Netherlands". */
const THE = new Set(["united-states", "united-kingdom", "netherlands", "czech-republic"]);
const withThe = (slug: string, name: string) => (THE.has(slug) ? `the ${name}` : name);

/** Cities shown on the country page: the ones with the most programs. */
const TOP_CITIES = 12;

export default async function CountryPage({ params }: Props) {
  const locale = await initPage(params);
  const country = await getCountry((await params).slug);
  // A country the robot created but whose guide isn't written yet has no page of its own.
  if (!country || !hasGuide(country)) notFound();
  const t = await getTranslations("country");
  const common = await getTranslations("common");
  const labels = await getTranslations("labels");
  const [rates, universities, scholarships, programs, cities] = await Promise.all([
    getRates(),
    listUniversities({ country: country.slug }),
    listScholarshipsForCountry(country.slug),
    getCatalogue(),
    listCities({ country: country.slug }),
  ]);
  const name = locale === "bn" ? country.name_bn : withThe(country.slug, country.name_en);
  const n = (v: number) => localizeDigits(String(v), locale);

  // Cities with programs, most first. Only cities with a written guide get a link to their own page.
  const inCountry = programs.filter((p) => p.country.slug === country.slug);
  const perCity = new Map<string, { slug: string; name_en: string; name_bn: string; count: number }>();
  for (const p of inCountry) {
    const c = perCity.get(p.city.slug) ?? { ...p.city, count: 0 };
    c.count++;
    perCity.set(p.city.slug, c);
  }
  const topCities = [...perCity.values()].sort((a, b) => b.count - a.count).slice(0, TOP_CITIES);
  const guided = new Set(cities.filter((c) => hasGuide(c)).map((c) => c.slug));

  const living = country.living_cost_min
    ? { min: country.living_cost_min, max: Math.max(country.living_cost_min, country.living_cost_max ?? country.living_cost_min) }
    : null;
  const before = country.before_start ?? [];
  const jobs = country.part_time_jobs ?? [];
  const jobLinks = country.job_links ?? [];
  const reading = country.reading ?? [];

  return (
    <div className="space-y-6 pb-4">
      {country.photo && (
        <figure className="-mx-4 sm:mx-0">
          <img src={country.photo.src} alt="" width={960} height={640} fetchPriority="high" className="aspect-[3/1.4] max-h-80 w-full object-cover sm:rounded-card" />
          <figcaption className="mt-1 px-4 text-[0.75rem] text-ink-muted sm:px-0">
            {t("photoBy")}{" "}
            <a href={country.photo.source_url} target="_blank" rel="noopener noreferrer" className="underline">
              {country.photo.credit}
            </a>
          </figcaption>
        </figure>
      )}

      <PageHeader
        title={t("title", { country: name })}
        eyebrow={<Badge icon="clock">{common("verifiedOn", { date: formatDate(country.last_verified, locale) })}</Badge>}
        subtitle={pick(country, "overview", locale)}
      >
        <ButtonLink href={`/programs?country=${country.slug}`} className="mt-4" size="sm">
          {t("seePrograms", { country: name })} <Icon name="arrowRight" className="size-4" />
        </ButtonLink>
      </PageHeader>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label={t("programs")} value={n(inCountry.length)} />
        <Fact label={t("universities")} value={n(universities.length)} />
        <Fact label={t("workHours")} value={t("hoursPerWeek", { hours: n(country.student_work_hours ?? 0) })} />
        <Fact
          label={t("living")}
          value={living ? `${formatBDT(toBDT(living.min, country.currency, rates), locale)}${living.max > living.min ? `–${formatBDT(toBDT(living.max, country.currency, rates), locale)}` : ""}` : "–"}
          hint={living ? t("perMonth") : undefined}
        />
      </dl>

      {before.length > 0 && (
        <Section title={t("beforeTitle")}>
          <Card>
            <ol className="space-y-3">
              {before.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-meta font-bold text-primary-ink">{n(i + 1)}</span>
                  <span>{bilingual(step, locale)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </Section>
      )}

      <Section title={t("educationTitle")}>
        <Card className="space-y-2">
          <p>{pick(country, "education_system", locale)}</p>
          {country.hsc_entry_note_en && (
            <p className="flex gap-2 rounded-tile bg-warning-soft p-3 text-meta">
              <Icon name="info" className="mt-0.5 size-4 shrink-0" />
              <span>{pick(country as { hsc_entry_note_en: string; hsc_entry_note_bn?: string }, "hsc_entry_note", locale)}</span>
            </p>
          )}
        </Card>
      </Section>

      <Section title={t("visaTitle")}>
        <Card className="space-y-2">
          <p>{pick(country, "visa_info", locale)}</p>
          <p className="text-meta text-ink-muted">{t("visaNote")}</p>
          <div className="flex flex-wrap gap-x-4">
            {country.visa_info_url && <ExternalLink href={country.visa_info_url}>{t("visaLink")}</ExternalLink>}
            {country.embassy_url && <ExternalLink href={country.embassy_url}>{t("embassyLink")}</ExternalLink>}
          </div>
        </Card>
      </Section>

      <Section title={t("workTitle")}>
        <Card className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <h3 className="text-meta font-semibold text-ink-muted">{t("workHours")}</h3>
              <p className="mt-0.5">{pick(country, "student_work_note", locale)}</p>
            </div>
            <div>
              <h3 className="text-meta font-semibold text-ink-muted">{t("minWage")}</h3>
              <p className="mt-0.5">
                {country.min_wage !== null && (
                  <span className="font-semibold">
                    {t("perHour", { amount: formatMoney(country.min_wage, country.currency, locale) })} ·{" "}
                    {t("aboutTaka", { amount: formatBDT(toBDT(country.min_wage, country.currency, rates), locale) })}.{" "}
                  </span>
                )}
                {pick(country, "min_wage_note", locale)}
              </p>
            </div>
          </div>
          {jobs.length > 0 && (
            <div>
              <h3 className="text-meta font-semibold text-ink-muted">{t("jobsTitle")}</h3>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {jobs.map((j, i) => (
                  <li key={i}>
                    <Badge>{bilingual(j, locale)}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {jobLinks.length > 0 && (
            <div>
              <h3 className="text-meta font-semibold text-ink-muted">{t("jobSites")}</h3>
              <div className="flex flex-wrap gap-x-4">
                {jobLinks.map((l) => (
                  <ExternalLink key={l.url} href={l.url}>
                    {l.name}
                  </ExternalLink>
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-border pt-3">
            <p className="text-meta font-semibold text-ink-muted">{t("postStudyTitle")}</p>
            <p className="mt-0.5">{pick(country, "post_study_work", locale)}</p>
          </div>
        </Card>
      </Section>

      {topCities.length > 0 && (
        <Section title={t("citiesTitle")}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {topCities.map((c) => (
              <li key={c.slug}>
                <Link
                  href={guided.has(c.slug) ? `/cities/${c.slug}` : `/programs?country=${country.slug}&city=${c.slug}`}
                  className="flex min-h-tap items-center justify-between gap-2 rounded-card bg-surface p-3 shadow-card hover:underline"
                >
                  <span className="font-semibold">{locale === "bn" ? c.name_bn : c.name_en}</span>
                  <span className="text-meta text-ink-muted">{t("programCount", { count: c.count })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {scholarships.length > 0 && (
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
      )}

      {reading.length > 0 && (
        <Section title={t("readingTitle")}>
          <Card>
            <ul className="space-y-2">
              {reading.map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="group flex items-start justify-between gap-3">
                    <span>
                      <span className="block font-semibold group-hover:underline">{r.title}</span>
                      <span className="block text-meta text-ink-muted">{r.source}</span>
                    </span>
                    <Icon name="external" className="mt-1 size-4 shrink-0 text-ink-muted" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-meta text-ink-muted">{t("readingNote")}</p>
          </Card>
        </Section>
      )}
    </div>
  );
}
