import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Breadcrumbs, PageHeader } from "@/components/ui/primitives";
import { routing } from "@/i18n/routing";
import { getGuide, guideSlugs } from "@/lib/guides";
import type { AppLocale } from "@/lib/localize";
import { initPage } from "@/lib/server";

type Props = { params: Promise<{ locale: string; slug: string }> };
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => guideSlugs().map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const g = getGuide(slug, locale as AppLocale);
  return g ? { title: g.title, description: g.summary } : {};
}

export default async function GuidePage({ params }: Props) {
  const locale = await initPage(params);
  const guide = getGuide((await params).slug, locale);
  if (!guide) notFound();
  const t = await getTranslations("guides");
  const common = await getTranslations("common");

  return (
    <article className="pb-4">
      <div className="pt-2">
        <Breadcrumbs label={common("breadcrumb")} items={[{ href: "/guides", label: t("title") }, { label: guide.title }]} />
      </div>
      <PageHeader title={guide.title} subtitle={guide.summary}>
        {guide.isFallback && <p className="mt-2 text-meta text-ink-muted">{common("englishOnly")}</p>}
      </PageHeader>
      {/* Our own Markdown, rendered at build time. */}
      <div className="prose-guide rounded-card bg-surface p-4 shadow-card sm:p-6" dangerouslySetInnerHTML={{ __html: guide.html }} />
    </article>
  );
}
