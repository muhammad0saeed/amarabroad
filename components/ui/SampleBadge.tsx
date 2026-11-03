import { useTranslations } from "next-intl";

// Shown on every card and page while the data is sample (Stage 1).
export function SampleBadge({ className = "" }: { className?: string }) {
  const t = useTranslations("common");
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
