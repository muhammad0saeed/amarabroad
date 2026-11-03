import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { initPage, type LocaleParams } from "@/lib/server";
import { site } from "@/lib/site";
import { InfoPage } from "@/components/layout/InfoPage";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "info.about" });
  return { title: t("title", { name: site.name }) };
}

export default async function AboutPage({ params }: LocaleParams) {
  await initPage(params);
  return <InfoPage page="about" />;
}
