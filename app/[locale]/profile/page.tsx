import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileView } from "@/components/profile/ProfileView";
import { PageHeader } from "@/components/ui/primitives";
import { getProfileFormOptions } from "@/lib/formOptions";
import { initPage, type LocaleParams } from "@/lib/server";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "profile" });
  return { title: t("title") };
}

export default async function ProfilePage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations("profile");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ProfileView options={await getProfileFormOptions()} />
    </>
  );
}
