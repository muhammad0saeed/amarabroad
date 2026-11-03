import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { SampleBadge } from "@/components/ui/SampleBadge";

// Temporary setup-check page; the real Home page is built in Phase 5.
export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");

  return (
    <div className="space-y-5 pt-2">
      <section>
        <SampleBadge />
        <p className="mt-4 text-meta font-medium text-ink-muted">{t("eyebrow")}</p>
        <h1 className="mt-1 text-display font-bold">{t("title")}</h1>
        <p className="mt-3 max-w-prose text-ink-muted">{t("subtitle")}</p>
      </section>

      <section className="rounded-card bg-primary p-5 text-on-primary shadow-card">
        <h2 className="text-heading font-semibold">{t("setupTitle")}</h2>
        <p className="mt-1 text-on-primary/85">{t("setupBody")}</p>
        <p className="mt-3 text-meta text-on-primary/85">{t("fontSample")}</p>
        <button
          type="button"
          className="mt-5 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-full bg-surface px-5 font-semibold text-primary-ink"
        >
          {t("matchCta")} <span aria-hidden="true">→</span>
        </button>
      </section>

      <section aria-hidden="true" className="flex gap-2 overflow-x-auto pb-1">
        {["bg-tile-indigo", "bg-tile-blue", "bg-tile-green", "bg-tile-pink", "bg-tile-amber", "bg-tile-teal"].map((bg) => (
          <span key={bg} className={`size-14 shrink-0 rounded-tile ${bg}`} />
        ))}
      </section>
    </div>
  );
}
