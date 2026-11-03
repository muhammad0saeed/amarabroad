import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/icons";
import { CountryCard } from "@/components/place/CountryCard";
import { ClosingSoon } from "@/components/scholarship/ClosingSoon";
import { Badge, ButtonLink, Section } from "@/components/ui/primitives";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Link } from "@/i18n/navigation";
import { getCoverage, listCities, listCountries, listScholarships } from "@/lib/data";
import { BUDGET_PRESETS_LAKH } from "@/lib/filters";
import { localizeDigits } from "@/lib/localize";
import { getFieldInfo, getSummaries, initPage, type LocaleParams } from "@/lib/server";

const QUICK_FIELDS = ["cse", "business", "data-science", "public-health", "eee", "economics"];

export default async function HomePage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const t = await getTranslations("home");
  const labels = await getTranslations("labels");
  const search = await getTranslations("search");
  const [countries, cities, scholarships, programs, coverage, fields] = await Promise.all([
    listCountries(),
    listCities(),
    listScholarships(),
    getSummaries(),
    getCoverage(),
    getFieldInfo(),
  ]);
  const chip = "inline-flex min-h-tap shrink-0 items-center rounded-full border border-border bg-surface px-4 text-meta font-semibold hover:border-primary";
  const n = (v: number) => localizeDigits(String(v), locale);

  return (
    <div className="space-y-8 pt-2 pb-4">
      <section>
        <SampleBadge />
        <p className="mt-4 text-meta font-medium text-ink-muted">{t("eyebrow")}</p>
        <h1 className="mt-1 text-display font-bold">{t("title")}</h1>
        <p className="mt-3 max-w-prose text-ink-muted">{t("subtitle")}</p>

        {/* Works without JavaScript: a plain GET to the search page. */}
        <form role="search" action={`/${locale}/programs/`} method="get" className="mt-5 flex gap-2">
          <label htmlFor="home-search" className="sr-only">
            {search("searchLabel")}
          </label>
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted" />
            <input
              id="home-search"
              name="q"
              type="search"
              placeholder={search("placeholder")}
              className="min-h-tap w-full rounded-full border border-border bg-surface pr-4 pl-11 shadow-card focus:border-primary focus:outline-none"
            />
          </div>
          <button type="submit" className="inline-flex min-h-tap items-center rounded-full bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover">
            {search("go")}
          </button>
        </form>

        <div className="mt-4 space-y-2">
          <p className="text-meta font-semibold text-ink-muted">{t("quickFilters")}</p>
          <div className="-mx-1 flex gap-2 no-scrollbar overflow-x-auto px-1 pb-1">
            {countries.map((c) => (
              <Link key={c.slug} href={`/programs?country=${c.slug}`} className={chip}>
                {locale === "bn" ? c.name_bn : c.name_en}
              </Link>
            ))}
            {(["master", "bachelor"] as const).map((level) => (
              <Link key={level} href={`/programs?level=${level}`} className={chip}>
                {labels(`level.${level}`)}
              </Link>
            ))}
          </div>
          <div className="-mx-1 flex gap-2 no-scrollbar overflow-x-auto px-1 pb-1">
            {BUDGET_PRESETS_LAKH.map((lakh) => (
              <Link key={lakh} href={`/programs?budget=${lakh}`} className={chip}>
                {search("underLakh", { amount: n(lakh) })}
              </Link>
            ))}
            <Link href="/programs?free=1" className={chip}>
              {search("tuitionFree")}
            </Link>
          </div>
          <div className="-mx-1 flex gap-2 no-scrollbar overflow-x-auto px-1 pb-1">
            {QUICK_FIELDS.map((f) => (
              <Link key={f} href={`/programs?field=${f}`} className={chip}>
                {locale === "bn" ? fields[f]?.name.bn : fields[f]?.name.en}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-card bg-primary p-5 text-on-primary shadow-card">
        <span className="inline-flex rounded-full bg-on-primary/15 px-2.5 py-1 text-meta font-semibold">{t("matchEyebrow")}</span>
        <h2 className="mt-3 text-title font-bold">{t("matchTitle")}</h2>
        <p className="mt-1 text-on-primary/85">{t("matchBody")}</p>
        <Link href="/match" className="mt-5 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-full bg-surface px-5 font-semibold text-primary-ink">
          {t("matchCta")} <Icon name="arrowRight" className="size-4" />
        </Link>
      </section>

      <Section
        title={t("closingSoon")}
        action={
          <Link href="/scholarships" className="inline-flex min-h-tap items-center text-meta font-semibold text-primary-ink hover:underline">
            {t("seeAll")}
          </Link>
        }
      >
        <ClosingSoon scholarships={scholarships.map(({ slug, name, provider, deadline, bd_eligible, type }) => ({ slug, name, provider, deadline, bd_eligible, type }))} />
      </Section>

      <Section title={t("countries")}>
        <ul className="grid gap-3 sm:grid-cols-3">
          {countries.map((c) => {
            const inCountry = programs.filter((p) => p.country.slug === c.slug);
            return (
              <li key={c.slug}>
                <CountryCard
                  country={c}
                  locale={locale}
                  programCount={inCountry.length}
                  cityNames={cities.filter((city) => city.country === c.slug).map((city) => (locale === "bn" ? city.name_bn : city.name_en))}
                  fromBDT={Math.min(...inCountry.map((p) => p.total_bdt))}
                />
              </li>
            );
          })}
        </ul>
      </Section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-card bg-surface p-4 shadow-card">
          <h2 className="font-semibold">{t("coverageTitle")}</h2>
          <p className="mt-1 text-meta text-ink-muted">
            {t("coverage", { countries: n(coverage.countries), universities: n(coverage.universities), programs: n(coverage.programs), scholarships: n(coverage.scholarships) })}
          </p>
          {coverage.allSample && <p className="mt-2 text-meta font-semibold text-warning">{t("coverageSample")}</p>}
        </div>
        <div className="rounded-card bg-surface p-4 shadow-card">
          <h2 className="flex items-center gap-2 font-semibold">
            <Icon name="send" className="size-5 text-primary-ink" /> {t("alertsTitle")}
          </h2>
          <p className="mt-1 text-meta text-ink-muted">{t("alertsBody")}</p>
          <Badge className="mt-2">{t("comingSoon")}</Badge>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/tools" variant="secondary" size="sm">
          <Icon name="tools" className="size-4" /> {t("toolsLink")}
        </ButtonLink>
        <ButtonLink href="/guides" variant="secondary" size="sm">
          <Icon name="book" className="size-4" /> {t("guidesLink")}
        </ButtonLink>
      </div>
    </div>
  );
}
