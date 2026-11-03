import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ScholarshipList } from "@/components/scholarship/ScholarshipList";
import { PageHeader } from "@/components/ui/primitives";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { listScholarships } from "@/lib/data";
import { initPage, type LocaleParams } from "@/lib/server";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "scholarship" });
  return { title: t("title") };
}

export default async function ScholarshipsPage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations("scholarship");
  return (
    <>
      <PageHeader eyebrow={<SampleBadge />} title={t("title")} subtitle={t("subtitle")} />
      <ScholarshipList scholarships={await listScholarships()} />
    </>
  );
}
