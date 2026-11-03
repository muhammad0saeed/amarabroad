import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CompareView } from "@/components/compare/CompareView";
import { PageHeader } from "@/components/ui/primitives";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { getFitContext, getSummaries, initPage, type LocaleParams } from "@/lib/server";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "compare" });
  return { title: t("title") };
}

export default async function ComparePage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations("compare");
  return (
    <>
      <PageHeader eyebrow={<SampleBadge />} title={t("title")} subtitle={t("subtitle")} />
      <Suspense fallback={<p className="text-ink-muted">{t("loading")}</p>}>
        <CompareView programs={await getSummaries()} fitContext={await getFitContext()} />
      </Suspense>
    </>
  );
}
