import { useTranslations } from "next-intl";
import { Icon } from "@/components/icons";

/**
 * Shown where a fact wasn't found on the university's official page. Never a guess, never a zero:
 * "Not found" sends the student to the official page instead.
 */
export function NotFound({ long = false, className = "" }: { long?: boolean; className?: string }) {
  const t = useTranslations("common");
  return (
    <span title={t("notFound")} className={`inline-flex items-center gap-1 text-ink-muted ${className}`}>
      <Icon name="info" className="size-3.5 shrink-0" />
      <span className="font-normal">{long ? t("notFound") : t("notFoundShort")}</span>
    </span>
  );
}
