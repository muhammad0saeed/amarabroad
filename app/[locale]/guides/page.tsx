import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GlossaryList } from "@/components/guides/GlossaryList";
import { Icon } from "@/components/icons";
import { IconTile, PageHeader, Section } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { listGlossary } from "@/lib/data";
import { listGuides } from "@/lib/guides";
import { initPage, type LocaleParams } from "@/lib/server";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "guides" });
  return { title: t("title") };
}

export default async function GuidesPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const t = await getTranslations("guides");
  const guides = listGuides(locale);
  const glossary = [...(await listGlossary())].sort((a, b) => a.term.localeCompare(b.term));

  return (
    <div className="space-y-8 pb-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Section title={t("articles")}>
        <ul className="grid gap-3 sm:grid-cols-2">
          {guides.map((g, i) => (
            <li key={g.slug}>
              <Link href={`/guides/${g.slug}`} className="flex h-full items-start gap-3 rounded-card bg-surface p-4 shadow-card hover:underline">
                <span className="lite:hidden">
                  <IconTile tile={(["amber", "indigo", "green", "blue", "pink"] as const)[i % 5]} icon={i === 0 ? "alert" : "book"} size="sm" />
                </span>
                <span>
                  <span className="block font-semibold">{g.title}</span>
                  <span className="text-meta text-ink-muted">{g.summary}</span>
                </span>
                <Icon name="chevronRight" className="ml-auto shrink-0 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t("glossary")} id="glossary">
        <GlossaryList terms={glossary} />
      </Section>
    </div>
  );
}
