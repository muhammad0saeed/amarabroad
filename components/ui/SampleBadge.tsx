import { useTranslations } from "next-intl";
import { IS_SAMPLE_DATA } from "@/lib/source";

// Shown on every card and page while the site runs on sample data (Stage 1).
export function SampleBadge({ className = "", force = false }: { className?: string; force?: boolean }) {
  const t = useTranslations("common");
  // On real data the badge only appears where a record says it's sample (force).
  if (!IS_SAMPLE_DATA && !force) return null;
  return (
    <span
      title={t("sampleNotice")}
      className={`inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-meta font-semibold text-warning ${className}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {t("sampleData")}
    </span>
  );
}
