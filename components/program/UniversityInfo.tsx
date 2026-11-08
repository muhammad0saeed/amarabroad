import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/icons";
import { Card, ExternalLink } from "@/components/ui/primitives";
import type { UniversityFact } from "@/lib/supabase/evidence";

/** Most sentences shown per kind of fact (a general page can list many dates). */
const MAX_PER_FIELD = 4;
const ORDER: UniversityFact["field"][] = ["deadline", "tuition", "english", "application_fee", "document"];

/**
 * Fills a program page's gaps with what the university's general pages say, word for word, with links.
 * Clearly labelled: one general page often covers many programs, so the student checks it applies.
 */
export async function UniversityInfo({ facts, gaps, level, university }: { facts: UniversityFact[]; gaps: UniversityFact["field"][]; level: "bachelor" | "master"; university: string }) {
  const t = await getTranslations("uniInfo");
  const shown = ORDER.filter((field) => gaps.includes(field))
    .map((field) => {
      const seen = new Set<string>();
      const rows = facts
        .filter((f) => f.field === field && (f.level === null || f.level === level))
        // This level's pages first, then general ones.
        .sort((a, b) => Number(b.level === level) - Number(a.level === level))
        .filter((f) => !seen.has(f.quote) && Boolean(seen.add(f.quote)))
        .slice(0, MAX_PER_FIELD);
      return { field, rows };
    })
    .filter((g) => g.rows.length);
  if (!shown.length) return null;
  return (
    <Card className="space-y-3 border border-dashed border-border">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <Icon name="info" className="size-5 text-primary-ink" /> {t("title", { university })}
        </h3>
        <p className="mt-1 text-meta text-ink-muted">{t("note")}</p>
      </div>
      {shown.map(({ field, rows }) => (
        <div key={field}>
          <h4 className="text-meta font-semibold">{t(`field.${field}`)}</h4>
          <ul className="mt-1 space-y-1.5">
            {rows.map((r) => (
              <li key={r.source_url + r.quote} className="rounded-tile bg-surface-2 px-3 py-2 text-meta">
                <q className="text-ink">{r.quote.replace(/^[#•\s]+/, "").replace(/\s*##\s*/g, " · ")}</q>
                <ExternalLink href={r.source_url} className="ml-1 min-h-0 text-meta">
                  {new URL(r.source_url).hostname.replace(/^www\./, "")}
                </ExternalLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}
