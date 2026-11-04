import { useTranslations } from "next-intl";
import { Icon, type IconName } from "@/components/icons";
import { Link } from "@/i18n/navigation";

// The five ways in: one row of tabs at the top of each browse page.
const TABS: { key: "programs" | "universities" | "cities" | "countries" | "scholarships"; href: string; icon: IconName }[] = [
  { key: "programs", href: "/programs", icon: "cap" },
  { key: "universities", href: "/universities", icon: "building" },
  { key: "cities", href: "/cities", icon: "pin" },
  { key: "countries", href: "/countries", icon: "globe" },
  { key: "scholarships", href: "/scholarships", icon: "scholarship" },
];

export type ExploreTab = (typeof TABS)[number]["key"];

export function ExploreTabs({ active }: { active: ExploreTab }) {
  const t = useTranslations("explore");
  return (
    <nav aria-label={t("label")} className="-mx-4 overflow-x-auto px-4 no-scrollbar">
      <ul className="flex w-max gap-1 rounded-full bg-surface-2 p-1">
        {TABS.map((tab) => {
          const current = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-meta font-semibold transition-colors ${
                  current ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink"
                }`}
              >
                <Icon name={tab.icon} className="size-4" weight={current ? "fill" : "regular"} />
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
