import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/primitives";
import { site } from "@/lib/site";

/** About, Disclaimer and Privacy: a title and paragraphs p1…pN from messages/<locale>.json → info.<page>. */
export async function InfoPage({ page, children }: { page: "about" | "disclaimer" | "privacy" | "contact"; children?: ReactNode }) {
  const t = await getTranslations(`info.${page}`);
  const count = Number(t("count"));
  return (
    <div className="pb-4">
      <PageHeader title={t("title", { name: site.name })} />
      <div className="prose-guide space-y-3 rounded-card bg-surface p-4 shadow-card sm:p-6">
        {Array.from({ length: count }, (_, i) => (
          <p key={i}>{t(`p${i + 1}`, { name: site.name })}</p>
        ))}
        {children}
      </div>
    </div>
  );
}
