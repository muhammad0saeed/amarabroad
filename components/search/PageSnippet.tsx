import { useTranslations } from "next-intl";
import { Icon } from "@/components/icons";

/** "…tuition fees «6,000» «euros» per semester…" → the words between « » highlighted. */
function highlighted(text: string) {
  return text.split(/(«[^»]*»)/g).map((part, i) =>
    part.startsWith("«") ? (
      <mark key={i} className="rounded bg-primary-soft px-0.5 font-semibold text-primary-ink">
        {part.slice(1, -1)}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/** Where the search words appear on the program's own official page, like a search-engine result. */
export function PageSnippet({ text, url }: { text: string; url: string }) {
  const t = useTranslations("common");
  return (
    <div className="mt-3 rounded-tile bg-surface-2 px-3 py-2 text-meta">
      <p className="flex items-center gap-1 font-semibold text-ink-muted">
        <Icon name="search" className="size-3.5" /> {t("foundOn")} · <span className="truncate font-normal">{new URL(url).hostname.replace(/^www\./, "")}</span>
      </p>
      {/* Headings ("##"), bullets and table bars from the cleaned page text are dropped for reading. */}
      <p className="mt-1 line-clamp-3 text-ink">…{highlighted(text.replace(/##\s*|•|\s\|\s/g, " ").replace(/\s+/g, " ").trim())}…</p>
    </div>
  );
}
