"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/icons";
import type { AppLocale } from "@/lib/localize";
import type { GlossaryTerm } from "@/types";

/** Searchable Bangla/English glossary; both explanations are shown so parents and students can share. */
export function GlossaryList({ terms }: { terms: GlossaryTerm[] }) {
  const t = useTranslations("guides");
  const locale = useLocale() as AppLocale;
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const shown = terms.filter((x) => !query || [x.term, x.term_bn ?? "", x.explain_en, x.explain_bn].some((s) => s.toLowerCase().includes(query)));

  return (
    <div className="space-y-3">
      <label htmlFor="glossary-search" className="sr-only">
        {t("searchGlossary")}
      </label>
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted" />
        <input
          id="glossary-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchGlossary")}
          className="min-h-tap w-full rounded-full border border-border bg-surface pr-4 pl-11 focus:border-primary focus:outline-none"
        />
      </div>
      <p aria-live="polite" className="text-meta text-ink-muted">
        {t("termCount", { count: shown.length })}
      </p>
      <dl className="divide-y divide-border rounded-card bg-surface shadow-card">
        {shown.map((x) => (
          <div key={x.slug} id={x.slug} className="scroll-mt-20 p-4">
            <dt className="font-semibold">
              {x.term}
              {x.term_bn && x.term_bn !== x.term && (
                <span lang="bn" className="ml-2 font-normal text-ink-muted">
                  {x.term_bn}
                </span>
              )}
            </dt>
            <dd lang="bn" className={`mt-1 ${locale === "bn" ? "" : "text-meta text-ink-muted"}`}>
              {x.explain_bn}
            </dd>
            <dd lang="en" className={`mt-1 ${locale === "en" ? "" : "text-meta text-ink-muted"}`}>
              {x.explain_en}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
