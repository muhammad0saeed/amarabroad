import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations("notFound");
  return (
    <div className="mx-auto mt-10 max-w-sm rounded-card bg-surface p-6 text-center shadow-card">
      <h1 className="text-title font-bold">{t("title")}</h1>
      <p className="mt-2 text-ink-muted">{t("body")}</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-tap items-center rounded-full bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover"
      >
        {t("back")}
      </Link>
    </div>
  );
}
