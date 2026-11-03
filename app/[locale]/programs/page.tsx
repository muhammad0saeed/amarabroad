import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ProgramCard } from "@/components/program/ProgramCard";
import { ProgramSearch } from "@/components/search/ProgramSearch";
import { PageHeader } from "@/components/ui/primitives";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { listCountries } from "@/lib/data";
import { getFieldInfo, getFitContext, getSummaries, initPage, type LocaleParams } from "@/lib/server";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return { title: t("title") };
}

export default async function ProgramsPage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations("search");
  const programs = await getSummaries();
  const fields = await getFieldInfo();
  const countries = (await listCountries()).map(({ slug, name_en, name_bn }) => ({ slug, name_en, name_bn }));

  return (
    <>
      <PageHeader eyebrow={<SampleBadge />} title={t("title")} subtitle={t("subtitle")} />
      {/* The static HTML shows the first programs right away; the full, filterable list takes over once the page loads. */}
      <Suspense
        fallback={
          <ul className="grid gap-3 md:grid-cols-2">
            {programs.slice(0, 12).map((p) => (
              <li key={p.slug}>
                <ProgramCard program={p} field={fields[p.field]} headingLevel="h2" />
              </li>
            ))}
          </ul>
        }
      >
        <ProgramSearch programs={programs} fields={fields} countries={countries} fitContext={await getFitContext()} />
      </Suspense>
    </>
  );
}
