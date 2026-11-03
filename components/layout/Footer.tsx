import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// On every page: short disclaimer + links to Disclaimer and Privacy (pages arrive in Phase 5).
export function Footer() {
  const t = useTranslations("footer");
  return (
    <footer className="border-t border-border px-4 py-6 text-meta text-ink-muted">
      <p className="max-w-prose">{t("disclaimer")}</p>
      <nav className="mt-3 flex gap-4">
        <Link href="/disclaimer" className="inline-flex min-h-tap items-center font-semibold text-primary-ink underline-offset-4 hover:underline">
          {t("disclaimerLink")}
        </Link>
        <Link href="/privacy" className="inline-flex min-h-tap items-center font-semibold text-primary-ink underline-offset-4 hover:underline">
          {t("privacyLink")}
        </Link>
      </nav>
    </footer>
  );
}
