import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BrowseHeader, LinkChips } from "@/components/explore/BrowseHeader";
import { Icon } from "@/components/icons";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { listCities, listCountries, listUniversities } from "@/lib/data";
import { localizeDigits } from "@/lib/localize";
import { formatBDT } from "@/lib/money";
import { getCatalogue } from "@/lib/search";
import { lowestTotal } from "@/lib/summary";
import { initPage } from "@/lib/server";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; country?: string; type?: string; page?: string }> };
const PAGE_SIZE = 24;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "browse" });
  return { title: t("universitiesTitle") };
}

export default async function UniversitiesPage({ params, searchParams }: Props) {
  const locale = await initPage(params);
  const t = await getTranslations("browse");
  const labels = await getTranslations("labels");
  const search = await getTranslations("search");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const country = sp.country ?? "";
  const type = sp.type === "public" || sp.type === "private" ? sp.type : "";
  const [countries, cities, universities, programs] = await Promise.all([listCountries(), listCities(), listUniversities(), getCatalogue()]);
  const cityOf = Object.fromEntries(cities.map((c) => [c.slug, c]));
  const countryOf = Object.fromEntries(countries.map((c) => [c.slug, c]));
  const name = (x: { name_en: string; name_bn: string }) => (locale === "bn" ? x.name_bn : x.name_en);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = universities.filter((u) => {
    const city = cityOf[u.city];
    if (country && city?.country !== country) return false;
    if (type && u.type !== type) return false;
    const hay = [u.name, city?.name_en, city?.name_bn, countryOf[city?.country ?? ""]?.name_en].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(Number(sp.page)) || 1), pageCount);
  const items = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const query = (next: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ q, country, type, ...next }).filter(([, v]) => v));
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const base = `/${locale}/universities/`;

  return (
    <>
      <BrowseHeader tab="universities" title={t("universitiesTitle")} subtitle={t("universitiesSubtitle")}>
        <form role="search" action={base} method="get" className="flex items-center gap-1 rounded-full border border-border bg-surface p-1 pl-4 shadow-card focus-within:border-accent">
          <label htmlFor="uni-search" className="sr-only">
            {t("searchUniversities")}
          </label>
          <Icon name="search" className="size-5 shrink-0 text-ink-muted" />
          <input id="uni-search" name="q" type="search" defaultValue={q} placeholder={t("universityPlaceholder")} className="min-h-tap min-w-0 flex-1 bg-transparent px-2 focus:outline-none" />
          {country && <input type="hidden" name="country" value={country} />}
          {type && <input type="hidden" name="type" value={type} />}
          <button type="submit" className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-primary px-4 text-meta font-semibold text-on-primary hover:bg-primary-hover">
            {search("go")}
          </button>
        </form>
        <LinkChips
          label={t("countriesTitle")}
          items={[
            { href: base + query({ country: "", page: "" }), label: t("all"), active: !country },
            ...countries.map((c) => ({ href: base + query({ country: c.slug, page: "" }), label: name(c), active: country === c.slug })),
            ...(["public", "private"] as const).map((k) => ({ href: base + query({ type: type === k ? "" : k, page: "" }), label: labels(`universityType.${k}`), active: type === k })),
          ]}
        />
      </BrowseHeader>

      <p className="mt-6 font-semibold" aria-live="polite">
        {t("count", { count: matches.length })}
      </p>
      {items.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon="building" title={t("noneFound")} body={t("noneFoundBody")} />
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((u) => {
            const city = cityOf[u.city];
            const own = programs.filter((p) => p.university.slug === u.slug);
            return (
              <li key={u.slug}>
                <article className="group/uni relative flex h-full flex-col rounded-card bg-surface p-4 shadow-card transition-shadow hover:shadow-float sm:p-5">
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-tile bg-surface-2 text-heading font-bold">
                      {u.name.replace(/^Sample /, "").charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <h2 className="leading-snug font-semibold tracking-tight">
                        <Link href={`/universities/${u.slug}`} className="after:absolute after:inset-0 after:rounded-card group-hover/uni:underline">
                          {u.name}
                        </Link>
                      </h2>
                      <p className="mt-0.5 flex items-center gap-1 text-meta text-ink-muted">
                        <Icon name="pin" className="size-4 shrink-0" />
                        {city ? `${name(city)}, ${name(countryOf[city.country]!)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-meta">
                    <span className="rounded-full bg-surface-2 px-2.5 py-0.5 font-medium">{labels(`universityType.${u.type}`)}</span>
                    {u.ranking && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-ink-muted">{t("ranked", { rank: localizeDigits(u.ranking.rank, locale) })}</span>}
                  </div>
                  <div className="flex-1" />
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-meta">
                    <span className="font-semibold">{t("programs", { count: own.length })}</span>
                    {lowestTotal(own) !== null && <span className="text-ink-muted">{t("from", { amount: formatBDT(lowestTotal(own)!, locale) })}</span>}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} pageCount={pageCount} href={(p) => `/universities${query({ page: p > 1 ? String(p) : "" })}`} />
    </>
  );
}
