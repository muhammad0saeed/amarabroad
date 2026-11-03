import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { NextDeadline } from "@/components/ui/NextDeadline";
import { Badge, IconTile } from "@/components/ui/primitives";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Link } from "@/i18n/navigation";
import { localizeDigits, type AppLocale } from "@/lib/localize";
import { formatBDT } from "@/lib/money";
import type { ProgramSummary } from "@/lib/summary";
import type { FieldGroup, TileColor } from "@/types";
import { ProgramCardActions } from "./ProgramActions";

export interface FieldInfo {
  name: { en: string; bn: string };
  group: FieldGroup;
  tile: TileColor;
}

export function ProgramCard({ program: p, field, fit, headingLevel = "h3" }: { program: ProgramSummary; field?: FieldInfo; fit?: ReactNode; headingLevel?: "h2" | "h3" }) {
  const t = useTranslations("program");
  const labels = useTranslations("labels");
  const locale = useLocale() as AppLocale;
  const Heading = headingLevel;
  const ielts = p.english_tests.find((e) => e.test === "ielts");

  return (
    <article className="relative flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="lite:hidden">
          <IconTile tile={field?.tile} group={field?.group} />
        </span>
        <div className="min-w-0 flex-1">
          <Heading className="font-semibold leading-snug">
            <Link href={`/programs/${p.slug}`} className="after:absolute after:inset-0 after:rounded-card hover:underline">
              {p.title}
            </Link>
          </Heading>
          <p className="mt-0.5 text-meta text-ink-muted">
            {p.university.name} · {locale === "bn" ? p.city.name_bn : p.city.name_en}, {locale === "bn" ? p.country.name_bn : p.country.name_en}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-meta">
        <div>
          <dt className="text-ink-muted">{t("totalCost")}</dt>
          <dd className="font-semibold">{formatBDT(p.total_bdt, locale)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t("duration")}</dt>
          <dd className="font-semibold">{t("months", { count: p.duration_months })}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{p.language === "en" ? "IELTS" : t("teaching")}</dt>
          <dd className="font-semibold">{p.language === "en" ? (ielts ? localizeDigits(String(ielts.min_score), locale) : "—") : labels(`lang.${p.language}`)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-1.5">
        <Badge tone="primary">{labels(`level.${p.degree_level}`)}</Badge>
        {p.tuition_per_year === 0 && <Badge tone="success">{t("tuitionFree")}</Badge>}
        {p.degree_level === "master" && (p.accepts_3yr_bachelor ? <Badge tone="success" icon="check">{t("tag3yr")}</Badge> : <Badge icon="close">{t("tagNo3yr")}</Badge>)}
        {p.accepts_moi && <Badge tone="success" icon="check">{t("tagMoi")}</Badge>}
        {p.accepts_provisional && <Badge tone="success" icon="check">{t("tagProvisional")}</Badge>}
        {!p.open_to_bd_citizens && <Badge tone="danger">{t("tagNotBd")}</Badge>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <NextDeadline intakes={p.intakes} />
        {fit}
      </div>

      <div className="relative z-10 flex items-center justify-between gap-2 border-t border-border pt-2">
        <SampleBadge />
        <ProgramCardActions slug={p.slug} title={p.title} />
      </div>
    </article>
  );
}
