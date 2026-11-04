"use client";

// Shared search state for the filter panel, search bar, chips and results.
// Filters live in the URL; the server renders results for that URL. Changing a filter updates the URL
// inside a transition, so checkboxes flip instantly (optimistic) while the new page of results loads.

import { createContext, useContext, useOptimistic, useTransition, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { EMPTY_FILTERS, serializeFilters, type ProgramFilters } from "@/lib/filters";
import type { FacetCounts } from "@/lib/filters";
import type { SearchOptions } from "@/lib/search";

interface SearchState {
  filters: ProgramFilters;
  facets: FacetCounts;
  options: SearchOptions;
  total: number;
  pending: boolean;
  /** Apply a change; any change except paging goes back to page 1. */
  update: (next: Partial<ProgramFilters>) => void;
  clear: () => void;
}

const Ctx = createContext<SearchState | null>(null);

export function useSearch(): SearchState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useSearch outside <SearchProvider>");
  return value;
}

export function SearchProvider({
  filters,
  facets,
  options,
  total,
  children,
}: {
  filters: ProgramFilters;
  facets: FacetCounts;
  options: SearchOptions;
  total: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(filters);

  function go(next: ProgramFilters) {
    startTransition(() => {
      setOptimistic(next);
      const qs = serializeFilters(next);
      router.replace(qs ? `/programs?${qs}` : "/programs", { scroll: false });
    });
  }

  const value: SearchState = {
    filters: optimistic,
    facets,
    options,
    total,
    pending,
    update: (next) => go({ ...optimistic, page: 1, ...next }),
    clear: () => go({ ...EMPTY_FILTERS, sort: optimistic.sort }),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Dims the results while a new page loads, and tells screen readers it's busy. */
export function ResultsRegion({ children, busyLabel }: { children: ReactNode; busyLabel: string }) {
  const { pending } = useSearch();
  return (
    <div aria-busy={pending} className={`transition-opacity ${pending ? "opacity-50" : ""}`}>
      {pending && <span className="sr-only" role="status">{busyLabel}</span>}
      {children}
    </div>
  );
}
