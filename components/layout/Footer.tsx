import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { site } from "@/lib/site";
import { IS_SAMPLE_DATA } from "@/lib/source";

// On every page: short disclaimer, where the data comes from (sample or real) and links to Disclaimer, Privacy and Report a problem.
export function Footer() {
  const t = useTranslations("footer");
  const linkClass = "inline-flex min-h-tap items-center font-semibold text-primary-ink underline-offset-4 hover:underline";
  return (
    <footer className="mt-10 border-t border-border px-4 pt-6 pb-28 text-meta text-ink-muted lg:pb-8">
      <p className="max-w-prose">{t("disclaimer")}</p>
      <p className="mt-2 max-w-prose">{t(IS_SAMPLE_DATA ? "sample" : "live")}</p>
      <nav aria-label={t("label")} className="mt-2 flex flex-wrap gap-x-5">
        <Link href="/disclaimer" className={linkClass}>
          {t("disclaimerLink")}
        </Link>
        <Link href="/privacy" className={linkClass}>
          {t("privacyLink")}
        </Link>
        <Link href="/contact" className={linkClass}>
          {t("reportProblem")}
        </Link>
        <Link href="/about" className={linkClass}>
          {t("about", { name: site.name })}
        </Link>
      </nav>
    </footer>
  );
}
