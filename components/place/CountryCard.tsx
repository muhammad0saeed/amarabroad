import { useTranslations } from "next-intl";
import { Icon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/lib/localize";
import { formatBDT } from "@/lib/money";
import type { Country } from "@/types";

// A soft colour wash per country instead of photos (fast on slow data).
const WASH: Record<string, string> = {
  italy: "from-tile-green to-tile-pink",
  germany: "from-tile-amber to-tile-blue",
  hungary: "from-tile-teal to-tile-indigo",
};

export function CountryCard({ country, locale, programCount, cityNames, fromBDT }: { country: Country; locale: AppLocale; programCount: number; cityNames: string[]; fromBDT: number }) {
  const t = useTranslations("home");
  return (
    <article className={`relative flex min-h-40 flex-col justify-between rounded-card bg-linear-to-br p-4 shadow-card lite:bg-none lite:bg-surface ${WASH[country.slug] ?? "from-tile-indigo to-tile-blue"}`}>
      <div>
        <h3 className="text-title font-bold">
          <Link href={`/countries/${country.slug}`} className="after:absolute after:inset-0 after:rounded-card">
            {locale === "bn" ? country.name_bn : country.name_en}
          </Link>
        </h3>
        <p className="mt-1 text-meta text-ink/80">{cityNames.join(" · ")}</p>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <dl className="text-meta">
          <div>
            <dt className="sr-only">{t("programsLabel")}</dt>
            <dd className="font-semibold">{t("programCount", { count: programCount })}</dd>
          </div>
          <div>
            <dt className="sr-only">{t("fromLabel")}</dt>
            <dd className="text-ink/80">{t("fromTotal", { amount: formatBDT(fromBDT, locale) })}</dd>
          </div>
        </dl>
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-surface/80 text-ink">
          <Icon name="arrowRight" />
        </span>
      </div>
    </article>
  );
}
