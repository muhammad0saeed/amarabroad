import { useTranslations } from "next-intl";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";
import { Link } from "@/i18n/navigation";
import { site } from "@/lib/site";

export function Header() {
  const t = useTranslations("header");
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3">
      <Link
        href="/"
        aria-label={t("home", { name: site.name })}
        className="inline-flex min-h-tap items-center text-heading font-bold tracking-tight"
      >
        <span className="text-ink">amar</span>
        <span className="text-primary-ink">Abroad</span>
      </Link>
      <div className="flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
