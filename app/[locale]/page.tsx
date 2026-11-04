/* eslint-disable @next/next/no-img-element -- illustrations and photos are pre-sized WebP files */
import { getTranslations } from "next-intl/server";
import { GROUP_ICON, Icon, type IconName } from "@/components/icons";
import { ClientMessages } from "@/components/layout/ClientMessages";
import { PlaceCard } from "@/components/place/PlaceCard";
import { ClosingSoon } from "@/components/scholarship/ClosingSoon";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Link } from "@/i18n/navigation";
import { getCoverage, listCities, listCountries, listScholarships, listUniversities } from "@/lib/data";
import { localizeDigits } from "@/lib/localize";
import { formatBDT } from "@/lib/money";
import { getCatalogue, getSearchOptions } from "@/lib/search";
import { initPage, type LocaleParams } from "@/lib/server";

export default async function HomePage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const t = await getTranslations("home");
  const explore = await getTranslations("explore");
  const search = await getTranslations("search");
  const browse = await getTranslations("browse");
  const [countries, cities, universities, scholarships, programs, coverage, options] = await Promise.all([
    listCountries(),
    listCities(),
    listUniversities(),
    listScholarships(),
    getCatalogue(),
    getCoverage(),
    getSearchOptions(),
  ]);
  const n = (v: number) => localizeDigits(String(v), locale);
  const name = (x: { name_en: string; name_bn: string }) => (locale === "bn" ? x.name_bn : x.name_en);

  const popular = [
    { href: "/programs?level=master&budget=30", label: t("popularMaster30") },
    { href: "/programs?3yr=1", label: t("popular3yr") },
    { href: "/programs?moi=1", label: t("popularMoi") },
    { href: "/programs?free=1", label: t("popularFree") },
  ];

  const tiles: { key: "programs" | "universities" | "cities" | "countries" | "scholarships"; href: string; icon: IconName; count: number }[] = [
    { key: "programs", href: "/programs", icon: "cap", count: programs.length },
    { key: "universities", href: "/universities", icon: "building", count: universities.length },
    { key: "cities", href: "/cities", icon: "pin", count: cities.length },
    { key: "countries", href: "/countries", icon: "globe", count: countries.length },
    { key: "scholarships", href: "/scholarships", icon: "scholarship", count: scholarships.length },
  ];

  return (
    <ClientMessages namespaces={["home", "labels", "common"]}>
      <div className="space-y-12 pt-2 pb-6">
        {/* Hero: text on the left, illustration on the right. */}
        <section className="relative grid items-center gap-6 md:grid-cols-[1.15fr_0.85fr] md:pt-6">
          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-2">
              <SampleBadge />
              <span className="text-meta text-ink-muted">{t("eyebrow")}</span>
            </div>
            <h1 className="mt-4 text-[2.125rem] leading-[1.04] font-bold tracking-[-0.04em] text-balance sm:text-[3.25rem] lg:text-[3.75rem]">{t("title")}</h1>
            <p className="mt-4 max-w-[46ch] text-ink-muted sm:text-[1.0625rem]">{t("subtitle")}</p>

            {/* Works without JavaScript: a plain GET to the search page. */}
            <form role="search" action={`/${locale}/programs/`} method="get" className="mt-6 flex max-w-xl items-center gap-1 rounded-full border border-border bg-surface p-1 pl-4 shadow-float focus-within:border-accent">
              <label htmlFor="home-search" className="sr-only">
                {search("searchLabel")}
              </label>
              <Icon name="search" className="size-5 shrink-0 text-ink-muted" />
              <input id="home-search" name="q" type="search" placeholder={search("placeholder")} className="min-h-12 min-w-0 flex-1 bg-transparent px-2 focus:outline-none" />
              <button type="submit" className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover">
                {search("go")}
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-meta text-ink-muted">{t("popular")}</span>
              {popular.map((p) => (
                <Link key={p.href} href={p.href} className="inline-flex min-h-9 items-center rounded-full border border-border bg-surface px-3 text-meta font-medium hover:border-ink/30">
                  {p.label}
                </Link>
              ))}
            </div>

            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-meta text-ink-muted">
              {(["taka", "rules", "bangla"] as const).map((k) => (
                <li key={k} className="inline-flex items-center gap-1.5">
                  <Icon name="checkCircle" className="size-4 text-accent" weight="fill" />
                  {t(`trust.${k}`)}
                </li>
              ))}
            </ul>
          </div>
          <img
            src="/illustrations/hero.webp"
            alt=""
            width={720}
            height={483}
            fetchPriority="high"
            className="pointer-events-none order-first -mb-2 ml-auto w-[58%] max-w-64 select-none md:order-none md:mb-0 md:w-full md:max-w-none lite:hidden"
          />
        </section>

        {/* Browse: bento of the five ways in. */}
        <section aria-labelledby="browse-title">
          <h2 id="browse-title" className="mb-3 text-heading font-semibold">
            {t("browseTitle")}
          </h2>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {tiles.map((tile, i) => (
              <li key={tile.key} className={i === 0 ? "col-span-2 lg:col-span-1" : ""}>
                <Link
                  href={tile.href}
                  className={`group flex h-full flex-col justify-between gap-6 rounded-card p-4 shadow-card transition-shadow hover:shadow-float ${
                    i === 0 ? "bg-ink text-canvas" : "bg-surface"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className={`grid size-10 place-items-center rounded-full ${i === 0 ? "bg-canvas/15" : "bg-surface-2"}`}>
                      <Icon name={tile.icon} className="size-5" />
                    </span>
                    <Icon name="external" className={`size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${i === 0 ? "text-canvas/70" : "text-ink-muted"}`} />
                  </span>
                  <span>
                    <span className="block text-title leading-none font-bold tracking-tight tabular-nums">{n(tile.count)}</span>
                    <span className="mt-1.5 block font-semibold">{explore(tile.key)}</span>
                    <span className={`block text-meta ${i === 0 ? "text-canvas/70" : "text-ink-muted"}`}>{t(`browseHint.${tile.key}`)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Match quiz. */}
        <section className="relative overflow-hidden rounded-card bg-ink p-6 text-canvas shadow-card sm:p-8">
          <img src="/illustrations/match.webp" alt="" width={658} height={666} loading="lazy" className="pointer-events-none float-right -mt-2 -mr-2 mb-2 ml-3 w-24 select-none sm:hidden lite:hidden" />
          <div className="relative z-10 max-w-md">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas/15 px-3 py-1 text-meta font-semibold">
              <Icon name="match" className="size-4" weight="fill" /> {t("matchEyebrow")}
            </span>
            <h2 className="mt-4 text-title leading-tight font-bold tracking-tight sm:text-display">{t("matchTitle")}</h2>
            <p className="mt-2 text-canvas/75">{t("matchBody")}</p>
            <Link href="/match" className="mt-6 inline-flex min-h-tap items-center gap-2 rounded-full bg-canvas px-5 font-semibold text-ink hover:bg-canvas/90">
              {t("matchCta")} <Icon name="arrowRight" className="size-4" />
            </Link>
          </div>
          <img src="/illustrations/match.webp" alt="" width={658} height={666} loading="lazy" className="pointer-events-none absolute top-1/2 right-6 hidden w-64 -translate-y-1/2 select-none sm:block lite:hidden" />
        </section>

        {/* Countries, with photos. */}
        <section aria-labelledby="countries-title">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 id="countries-title" className="text-heading font-semibold">
              {t("countries")}
            </h2>
            <Link href="/countries" className="inline-flex min-h-tap items-center gap-1 text-meta font-semibold text-primary-ink hover:underline">
              {t("seeAll")} <Icon name="arrowRight" className="size-4" />
            </Link>
          </div>
          <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {countries.map((c) => {
              const inCountry = programs.filter((p) => p.country.slug === c.slug);
              return (
                <li key={c.slug} className="w-[78%] shrink-0 snap-start sm:w-auto">
                  <PlaceCard
                    href={`/countries/${c.slug}`}
                    title={name(c)}
                    subtitle={cities.filter((x) => x.country === c.slug).map(name).join(" · ")}
                    photo={c.photo}
                    stats={[
                      browse("programs", { count: inCountry.length }),
                      ...(inCountry.length ? [browse("from", { amount: formatBDT(Math.min(...inCountry.map((p) => p.total_bdt)), locale) })] : []),
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        </section>

        {/* Subjects. */}
        <section aria-labelledby="subjects-title">
          <h2 id="subjects-title" className="mb-3 text-heading font-semibold">
            {t("subjectsTitle")}
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {options.fieldGroups.map((g) => {
              const count = programs.filter((p) => p.field_group === g).length;
              return (
                <li key={g}>
                  <Link href={`/programs?area=${g}`} className="flex min-h-16 items-center gap-3 rounded-tile bg-surface px-3 py-2 shadow-card hover:shadow-float">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-ink">
                      <Icon name={GROUP_ICON[g]} className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 block text-meta leading-tight font-semibold">{search(`areas.${g}`)}</span>
                      <span className="block text-[0.75rem] text-ink-muted">{browse("programs", { count })}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Scholarships closing soon. */}
        <section aria-labelledby="closing-title" className="grid items-center gap-4 md:grid-cols-[0.7fr_1.3fr] md:gap-8">
          <div>
            <img src="/illustrations/scholarship.webp" alt="" width={646} height={483} loading="lazy" className="w-36 select-none md:w-52 lite:hidden" />
            <h2 id="closing-title" className="mt-3 text-title leading-tight font-bold tracking-tight">
              {t("closingSoon")}
            </h2>
            <Link href="/scholarships" className="mt-2 inline-flex min-h-tap items-center gap-1 text-meta font-semibold text-primary-ink hover:underline">
              {t("seeAll")} <Icon name="arrowRight" className="size-4" />
            </Link>
          </div>
          <ClosingSoon scholarships={scholarships.map(({ slug, name, provider, deadline, bd_eligible, type }) => ({ slug, name, provider, deadline, bd_eligible, type }))} />
        </section>

        {/* Guides and tools. */}
        <section className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
          <Link href="/guides" className="group relative flex min-h-48 overflow-hidden rounded-card bg-primary-soft p-5 shadow-card sm:p-6">
            <div className="relative z-10 max-w-[60%]">
              <h2 className="text-title leading-tight font-bold tracking-tight text-ink">{t("guidesTitle")}</h2>
              <p className="mt-2 text-meta text-ink-muted">{t("guidesBody")}</p>
              <span className="mt-4 inline-flex items-center gap-1 font-semibold text-primary-ink">
                {t("guidesCta")} <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
            <img src="/illustrations/guides.webp" alt="" width={708} height={564} loading="lazy" className="pointer-events-none absolute -right-6 -bottom-6 w-44 select-none sm:w-56 lite:hidden" />
          </Link>
          <Link href="/tools" className="group flex flex-col justify-between rounded-card bg-surface p-5 shadow-card sm:p-6">
            <span className="grid size-10 place-items-center rounded-full bg-surface-2">
              <Icon name="tools" className="size-5" />
            </span>
            <span className="mt-6">
              <span className="block text-heading font-bold tracking-tight">{t("toolsTitle")}</span>
              <span className="mt-1 block text-meta text-ink-muted">{t("toolsBody")}</span>
              <span className="mt-3 inline-flex items-center gap-1 text-meta font-semibold text-primary-ink">
                {t("toolsCta")} <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </Link>
        </section>

        {/* Coverage and alerts: small print. */}
        <section className="grid gap-3 border-t border-border pt-6 text-meta sm:grid-cols-2">
          <div>
            <h2 className="font-semibold">{t("coverageTitle")}</h2>
            <p className="mt-1 text-ink-muted">
              {t("coverage", { countries: n(coverage.countries), universities: n(coverage.universities), programs: n(coverage.programs), scholarships: n(coverage.scholarships) })}
            </p>
            {coverage.allSample && <p className="mt-1 font-semibold text-warning">{t("coverageSample")}</p>}
          </div>
          <div>
            <h2 className="flex items-center gap-1.5 font-semibold">
              <Icon name="send" className="size-4 text-accent" /> {t("alertsTitle")}
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-muted">{t("comingSoon")}</span>
            </h2>
            <p className="mt-1 text-ink-muted">{t("alertsBody")}</p>
          </div>
        </section>
      </div>
    </ClientMessages>
  );
}
