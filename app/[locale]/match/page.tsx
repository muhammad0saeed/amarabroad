import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MatchView } from "@/components/match/MatchView";
import { PageHeader } from "@/components/ui/primitives";
import { getProfileFormOptions } from "@/lib/formOptions";
import { getFieldInfo, getFitContext, initPage, type LocaleParams } from "@/lib/server";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "match" });
  return { title: t("title") };
}

export default async function MatchPage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations("match");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <MatchView fields={await getFieldInfo()} fitContext={await getFitContext()} options={await getProfileFormOptions()} />
    </>
  );
}
