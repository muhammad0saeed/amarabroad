import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SavedView } from "@/components/saved/SavedView";
import { PageHeader } from "@/components/ui/primitives";
import { getFieldInfo, getFitContext, getSummaries, initPage, type LocaleParams } from "@/lib/server";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "saved" });
  return { title: t("title") };
}

export default async function SavedPage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations("saved");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SavedView programs={await getSummaries()} fields={await getFieldInfo()} fitContext={await getFitContext()} />
    </>
  );
}
