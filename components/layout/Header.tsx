import { useTranslations } from "next-intl";
import { LanguageToggle } from "./LanguageToggle";
import { NavLink } from "./NavLink";
import { ThemeToggle } from "./ThemeToggle";
import { Link } from "@/i18n/navigation";
import { site } from "@/lib/site";

const DESKTOP_LINKS = [
  ["/programs", "programs"],
  ["/scholarships", "scholarships"],
  ["/match", "match"],
  ["/compare", "compare"],
  ["/tools", "tools"],
  ["/guides", "guides"],
  ["/saved", "saved"],
] as const;

export function Header() {
  const t = useTranslations("header");
  const nav = useTranslations("nav");
  return (
    <header className="sticky top-0 z-30 bg-canvas/90 backdrop-blur-sm lite:backdrop-blur-none">
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <Link href="/" aria-label={t("home", { name: site.name })} className="inline-flex min-h-tap items-center text-heading font-bold tracking-tight">
          <span className="text-ink">amar</span>
          <span className="text-primary-ink">Abroad</span>
        </Link>
        <nav aria-label={nav("main")} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {DESKTOP_LINKS.map(([href, key]) => (
              <li key={href}>
                <NavLink href={href} variant="desktop">
                  {nav(key)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
