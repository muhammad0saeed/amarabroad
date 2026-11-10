"use client";

import { useLocale, useTranslations } from "next-intl";
import { DaysLeft } from "@/components/ui/DaysLeft";
import { IconTile } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { useHydrated } from "@/lib/clientStore";
import { todayISO } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/lib/localize";
import type { ISODate } from "@/types";

export interface ProgramDeadlineTeaser {
  slug: string;
  title: string;
  university: string;
  country: { en: string; bn: string };
  deadline: ISODate;
  universityWide: boolean;
}

/** The programs whose application deadlines come next ("today" is the visitor's own, so a cached page never shows a passed one). */
export function ProgramsClosingSoon({ programs, limit = 6 }: { programs: ProgramDeadlineTeaser[]; limit?: number }) {
  const t = useTranslations("home");
  const common = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const hydrated = useHydrated();
  const today = hydrated ? todayISO() : "";
  // One program per university, so a single university's shared deadline doesn't fill the whole list.
  const seen = new Set<string>();
  const open = programs
    .filter((p) => !hydrated || p.deadline >= today)
    .sort((a, b) => (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0))
    .filter((p) => !seen.has(p.university) && seen.add(p.university))
    .slice(0, limit);

  if (open.length === 0) return <p className="text-ink-muted">{t("programsClosingSoonNone")}</p>;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {open.map((p) => (
        <li key={p.slug} className="relative flex items-center gap-3 rounded-card bg-surface p-3 shadow-card">
          <span className="lite:hidden">
            <IconTile tile="pink" icon="calendar" size="sm" />
          </span>
          <div className="min-w-0 flex-1">
            <Link href={`/programs/${p.slug}`} className="line-clamp-2 font-semibold leading-snug after:absolute after:inset-0 hover:underline">
              {p.title}
            </Link>
            <p className="truncate text-meta text-ink-muted">
              {p.university} · {locale === "bn" ? p.country.bn : p.country.en}
            </p>
            <p className="text-meta text-ink-muted">
              {formatDate(p.deadline, locale)}
              {p.universityWide && ` (${common("universityWideShort")})`}
            </p>
          </div>
          <DaysLeft date={p.deadline} />
        </li>
      ))}
    </ul>
  );
}
