import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CostCalculator, GradeConverter, TimelinePlanner } from "@/components/tools/Tools";
import { PageHeader } from "@/components/ui/primitives";
import { getCountry, listCities, listPrograms, listScholarships } from "@/lib/data";
import { getRates, initPage, type LocaleParams } from "@/lib/server";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "tools" });
  return { title: t("title") };
}

export default async function ToolsPage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations("tools");
  const cities = await Promise.all(
    (await listCities()).map(async (c) => {
      const country = (await getCountry(c.country))!;
      const base = c.cost_food + c.cost_transport + c.cost_phone + c.cost_insurance;
      return { slug: c.slug, name_en: c.name_en, name_bn: c.name_bn, currency: country.currency, shared: base + c.cost_rent_shared, studio: base + c.cost_rent_studio };
    }),
  );
  const programs = (await listPrograms()).map(({ slug, title, intakes }) => ({ slug, title, intakes }));
  const scholarships = (await listScholarships()).map(({ slug, name, deadline }) => ({ slug, name, deadline }));

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="space-y-5">
        <GradeConverter />
        <CostCalculator cities={cities} rates={await getRates()} />
        <TimelinePlanner programs={programs} scholarships={scholarships} />
      </div>
    </>
  );
}
