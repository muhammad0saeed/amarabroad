import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProblemReport } from "@/components/forms/ReportForms";
import { InfoPage } from "@/components/layout/InfoPage";
import { initPage, type LocaleParams } from "@/lib/server";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "info.contact" });
  return { title: t("title", { name: site.name }) };
}

export default async function ContactPage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations("info.contact");
  return (
    <InfoPage page="contact">
      <h2 id="report" className="scroll-mt-20 pt-2 text-heading font-semibold">
        {t("formTitle")}
      </h2>
      <ProblemReport />
    </InfoPage>
  );
}
