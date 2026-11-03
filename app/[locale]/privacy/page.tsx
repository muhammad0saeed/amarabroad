import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InfoPage } from "@/components/layout/InfoPage";
import { initPage, type LocaleParams } from "@/lib/server";
import { site } from "@/lib/site";
import { STORAGE_KEYS } from "@/lib/storage";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "info.privacy" });
  return { title: t("title", { name: site.name }) };
}

export default async function PrivacyPage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations("info.privacy");
  return (
    <InfoPage page="privacy">
      <h2 className="pt-2 text-heading font-semibold">{t("storedTitle")}</h2>
      <ul className="space-y-1">
        {(Object.keys(STORAGE_KEYS) as (keyof typeof STORAGE_KEYS)[]).map((key) => (
          <li key={key}>
            <code className="rounded bg-surface-2 px-1.5 py-0.5 text-meta">{STORAGE_KEYS[key]}</code> {t(`keys.${key}`)}
          </li>
        ))}
      </ul>
      <p>{t("howToDelete")}</p>
    </InfoPage>
  );
}
