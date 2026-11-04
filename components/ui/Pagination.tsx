import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { localizeDigits, type AppLocale } from "@/lib/localize";

/** Server-rendered page links (plain <a>s, so they work before any JavaScript loads). */
export function Pagination({ page, pageCount, href }: { page: number; pageCount: number; href: (page: number) => string }) {
  const t = useTranslations("search");
  const locale = useLocale() as AppLocale;
  if (pageCount <= 1) return null;
  const d = (n: number) => localizeDigits(String(n), locale);

  // 1 … 4 5 6 … 20
  const pages = [...new Set([1, page - 1, page, page + 1, pageCount])].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const item = "inline-flex min-h-tap min-w-tap items-center justify-center rounded-full px-3 text-meta font-semibold";

  return (
    <nav aria-label={t("pagination")} className="mt-6 flex items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={href(page - 1)} className={`${item} gap-1 hover:bg-surface-2`} rel="prev">
          <Icon name="chevronLeft" className="size-4" />
          <span className="max-sm:sr-only">{t("prev")}</span>
        </Link>
      ) : null}
      <ul className="flex items-center gap-1">
        {pages.map((p, i) => (
          <li key={p} className="flex items-center gap-1">
            {i > 0 && p - pages[i - 1]! > 1 && <span aria-hidden="true" className="px-1 text-ink-muted">…</span>}
            <Link href={href(p)} aria-current={p === page ? "page" : undefined} className={`${item} ${p === page ? "bg-ink text-canvas" : "hover:bg-surface-2"}`}>
              {d(p)}
            </Link>
          </li>
        ))}
      </ul>
      {page < pageCount ? (
        <Link href={href(page + 1)} className={`${item} gap-1 hover:bg-surface-2`} rel="next">
          <span className="max-sm:sr-only">{t("next")}</span>
          <Icon name="chevronRight" className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
