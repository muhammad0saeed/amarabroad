import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ExploreTabs } from "@/components/explore/ExploreTabs";
import { FitBadge } from "@/components/fit/FitScore";
import { ProgramCard } from "@/components/program/ProgramCard";
import { FilterPanel } from "@/components/search/FilterPanel";
import { PageSnippet } from "@/components/search/PageSnippet";
import { ActiveFilters, MobileFilters, SearchBar, SortSelect } from "@/components/search/SearchControls";
import { ResultsRegion, SearchProvider } from "@/components/search/SearchState";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/primitives";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { todayISO } from "@/lib/dates";
import { PAGE_SIZE, parseFilters, serializeFilters } from "@/lib/filters";
import { localizeDigits } from "@/lib/localize";
import { getSearchOptions, searchPrograms } from "@/lib/search";
import { getFieldInfo, getFitContext, initPage } from "@/lib/server";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return { title: t("title") };
}

function toParams(raw: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") params.set(key, value);
  return params;
}

// Rendered on the server for each URL: only one page of results is sent to the browser.
export default async function ProgramsPage({ params, searchParams }: Props) {
  const locale = await initPage(params);
  const t = await getTranslations("search");
  const filters = parseFilters(toParams(await searchParams));
  const [result, options, fields, fitContext] = await Promise.all([searchPrograms(filters, todayISO()), getSearchOptions(), getFieldInfo(), getFitContext()]);
  const d = (n: number) => localizeDigits(String(n), locale);
  const from = (result.page - 1) * PAGE_SIZE + 1;
  const pageHref = (page: number) => {
    const qs = serializeFilters({ ...filters, page });
    return qs ? `/programs?${qs}` : "/programs";
  };

  return (
    <SearchProvider filters={{ ...filters, page: result.page }} facets={result.facets} options={options} total={result.total}>
      <div className="space-y-4 pt-2">
        <ExploreTabs active="programs" />
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 pt-2">
          <h1 className="text-title font-bold tracking-tight sm:text-display">{t("title")}</h1>
          <SampleBadge />
        </header>
        <SearchBar />
      </div>

      <div className="mt-5 lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-8">
        <aside aria-label={t("filters")} className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-2 pb-6 no-scrollbar">
            <FilterPanel />
          </div>
        </aside>

        <section aria-labelledby="results-title" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="results-title" aria-live="polite" className="font-semibold">
              {result.total
                ? t("resultRange", { from: d(from), to: d(from + result.items.length - 1), total: d(result.total) })
                : t("resultCount", { count: 0 })}
            </h2>
            <div className="flex items-center gap-2">
              <MobileFilters />
              <SortSelect />
            </div>
          </div>
          <div className="mt-3">
            <ActiveFilters />
          </div>

          <ResultsRegion busyLabel={t("updating")}>
            {result.items.length === 0 ? (
              <div className="mt-4">
                <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
              </div>
            ) : (
              <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {result.items.map((p) => (
                  <li key={p.slug}>
                    <ProgramCard
                      program={p}
                      field={fields[p.field]}
                      fit={<FitBadge program={p} ctx={fitContext} />}
                      headingLevel="h3"
                      snippet={result.snippets[p.slug] ? <PageSnippet {...result.snippets[p.slug]!} /> : undefined}
                    />
                  </li>
                ))}
              </ul>
            )}
            <Pagination page={result.page} pageCount={result.pageCount} href={pageHref} />
          </ResultsRegion>
        </section>
      </div>
    </SearchProvider>
  );
}
