"use client";

import { useTranslations } from "next-intl";
import { Icon, type IconName } from "@/components/icons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { LiteToggle } from "./LiteToggle";
import { Link } from "@/i18n/navigation";

const LINKS: [string, IconName, string][] = [
  ["/scholarships", "scholarship", "scholarships"],
  ["/news", "news", "news"],
  ["/compare", "compare", "compare"],
  ["/tools", "tools", "tools"],
  ["/guides", "book", "guides"],
  ["/profile", "user", "profile"],
  ["/about", "info", "about"],
  ["/disclaimer", "alert", "disclaimer"],
  ["/privacy", "check", "privacy"],
  ["/contact", "send", "contact"],
];

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("nav");
  return (
    <BottomSheet open={open} onClose={onClose} title={t("more")} closeLabel={t("close")}>
      <ul className="grid grid-cols-1 gap-1 xs:grid-cols-2">
        {LINKS.map(([href, icon, key]) => (
          <li key={href}>
            <Link href={href} onClick={onClose} className="flex min-h-tap items-center gap-3 rounded-tile px-3 py-2 font-semibold hover:bg-surface-2">
              <Icon name={icon} className="size-5 text-primary-ink" />
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 border-t border-border pt-3">
        <LiteToggle />
      </div>
    </BottomSheet>
  );
}
