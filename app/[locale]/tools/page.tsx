import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CostCalculator, GradeConverter, TimelinePlanner } from "@/components/tools/Tools";
import { PageHeader } from "@/components/ui/primitives";
import { getCountry, listCities, listPrograms, listScholarships } from "@/lib/data";
import { monthlyLivingCost } from "@/lib/cost";
import { getRates, initPage, type LocaleParams } from "@/lib/server";
import { todayISO } from "@/lib/dates";
import { nextDeadline } from "@/lib/summary";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "tools" });
  return { title: t("title") };
}

export default async function ToolsPage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations("tools");
  // Only cities whose guide has living costs can feed the calculator.
  const cities = (
    await Promise.all(
      (await listCities()).map(async (c) => {
        const country = (await getCountry(c.country))!;
        const shared = monthlyLivingCost(c, "shared");
        const studio = monthlyLivingCost(c, "studio");
        return shared === null || studio === null ? null : { slug: c.slug, name_en: c.name_en, name_bn: c.name_bn, currency: country.currency, shared, studio };
      }),
    )
  ).filter((c) => c !== null);
  // The planner needs a deadline to plan from. All 34,000 programs in one dropdown made this page 9 MB, so it
  // offers the 300 programs whose deadlines come next (each program page has its own "Add to calendar").
  const today = todayISO();
  const programs = (await listPrograms())
    .flatMap(({ slug, title, intakes }) => {
      const next = nextDeadline(intakes, today);
      return next ? [{ slug, title, intakes: [{ month: next.month, year: next.year, deadline: next.deadline }] }] : [];
    })
    .sort((x, y) => (x.intakes[0]!.deadline < y.intakes[0]!.deadline ? -1 : 1))
    .slice(0, 300);
  const scholarships = (await listScholarships()).flatMap(({ slug, name, deadline }) => (deadline ? [{ slug, name, deadline }] : []));

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
