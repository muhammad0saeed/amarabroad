"use client";

import { useLocale, useTranslations } from "next-intl";
import { DaysLeft } from "@/components/ui/DaysLeft";
import { Badge, IconTile } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { useHydrated } from "@/lib/clientStore";
import { todayISO } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/lib/localize";
import type { ISODate } from "@/types";

export interface ScholarshipTeaser {
  slug: string;
  name: string;
  provider: string;
  deadline: ISODate;
  bd_eligible: boolean;
  type: "merit" | "need" | "mixed";
}

/** The next few open scholarship deadlines (worked out on the device). */
export function ClosingSoon({ scholarships, limit = 3 }: { scholarships: ScholarshipTeaser[]; limit?: number }) {
  const t = useTranslations("home");
  const labels = useTranslations("labels");
  const locale = useLocale() as AppLocale;
  const hydrated = useHydrated();
  const today = hydrated ? todayISO() : "";
  const open = [...scholarships]
    .filter((s) => s.bd_eligible && (!hydrated || s.deadline >= today))
    .sort((a, b) => (a.deadline < b.deadline ? -1 : 1))
    .slice(0, limit);

  if (open.length === 0) return <p className="text-ink-muted">{t("noneClosing")}</p>;
  return (
    <ul className="space-y-2">
      {open.map((s) => (
        <li key={s.slug} className="relative flex items-center gap-3 rounded-card bg-surface p-3 shadow-card">
          <span className="lite:hidden">
            <IconTile tile="amber" icon="scholarship" size="sm" />
          </span>
          <div className="min-w-0 flex-1">
            <Link href={`/scholarships/${s.slug}`} className="font-semibold leading-snug after:absolute after:inset-0 hover:underline">
              {s.name}
            </Link>
            <p className="flex flex-wrap items-center gap-1.5 text-meta text-ink-muted">
              <Badge>{labels(`scholarshipType.${s.type}`)}</Badge>
              {formatDate(s.deadline, locale)}
            </p>
          </div>
          <DaysLeft date={s.deadline} />
        </li>
      ))}
    </ul>
  );
}
