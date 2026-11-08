import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/icons";
import { AddToCalendar } from "@/components/ui/AddToCalendar";
import { DaysLeft } from "@/components/ui/DaysLeft";
import { Badge, Card, ExternalLink, Fact, PageHeader, Section } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { DATA_SOURCE, getScholarship, listCountries, listProgramContexts, listScholarships, listScholarshipsForProgram, listUniversities } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { localizeDigits, pick } from "@/lib/localize";
import { formatMoney } from "@/lib/money";
import { cycleOf, roundOf } from "@/lib/scholarshipRound";
import { initPage } from "@/lib/server";

type Props = { params: Promise<{ locale: string; slug: string }> };
// Live data: pages are made on first visit and kept for 10 minutes. Sample data: all made at build time.
export const dynamicParams = true;
export const revalidate = 600;

export async function generateStaticParams() {
  if (DATA_SOURCE === "supabase") return [];
  const scholarships = await listScholarships();
  return routing.locales.flatMap((locale) => scholarships.map((s) => ({ locale, slug: s.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await getScholarship((await params).slug);
  return s ? { title: s.name, description: s.coverage.summary_en } : {};
}

export default async function ScholarshipPage({ params }: Props) {
  const locale = await initPage(params);
  const s = await getScholarship((await params).slug);
  if (!s) notFound();
  const t = await getTranslations("scholarship");
  const common = await getTranslations("common");
  const labels = await getTranslations("labels");
  const fit = await getTranslations("fit");

  // Programs it applies to: the program list, or everything under its universities and countries, at its levels.
  const contexts = await listProgramContexts();
  const applies: typeof contexts = [];
  for (const ctx of contexts) {
    if ((await listScholarshipsForProgram(ctx.program.slug)).some((x) => x.slug === s.slug)) applies.push(ctx);
  }
  const countries = (await listCountries()).filter((c) => s.countries.includes(c.slug));
  const universities = (await listUniversities()).filter((u) => s.universities.includes(u.slug));
  const stipend = s.coverage.stipend;
  const round = roundOf(s);
  const cycle = cycleOf(s, locale);

  return (
    <div className="space-y-6 pb-4">
      <PageHeader
        title={s.name}
        eyebrow={
          <>
            <Badge tone={s.type === "need" ? "neutral" : "primary"}>{labels(`scholarshipType.${s.type}`)}</Badge>
            {s.bd_eligible ? <Badge tone="success" icon="check">{t("bdEligible")}</Badge> : <Badge tone="danger">{t("notBdEligible")}</Badge>}
          </>
        }
        subtitle={s.provider}
      />

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact
          label={t("deadline")}
          value={s.deadline ? formatDate(s.deadline, locale) : t(`round.${round}`)}
          hint={s.deadline ? <DaysLeft date={s.deadline} /> : round === "closed" && s.last_deadline ? t("round.closedOn", { date: formatDate(s.last_deadline, locale) }) : undefined}
        />
        <Fact label={t("tuition")} value={labels(`coverage.${s.coverage.tuition}`)} hint={s.coverage.tuition_percent ? `${localizeDigits(String(s.coverage.tuition_percent), locale)}%` : undefined} />
        <Fact
          label={t("stipend")}
          value={stipend ? formatMoney(stipend.amount, stipend.currency, locale) : t("none")}
          hint={stipend ? t(stipend.per === "month" ? "perMonth" : "perYear") : undefined}
        />
        <Fact label={t("levels")} value={s.levels.map((l) => labels(`level.${l}`)).join(", ")} />
      </dl>

      {s.deadline && (
        <div className="flex flex-wrap gap-2">
          <AddToCalendar fileSlug={s.slug} event={{ uid: `scholarship-${s.slug}@amarabroad`, title: t("calendarTitle", { name: s.name }), description: s.provider, url: s.official_url, date: s.deadline }} />
        </div>
      )}

      {(cycle || s.deadline_quote) && (
        <Section title={t("usually")}>
          <Card className="space-y-3">
            {cycle && <p>{cycle}</p>}
            {s.deadline_quote && (
              <figure className="text-meta">
                <figcaption className="font-semibold text-ink-muted">{t("fromPage")}</figcaption>
                <blockquote className="mt-1 border-l-2 border-accent pl-3">&ldquo;{s.deadline_quote}&rdquo;</blockquote>
                {s.source_url && <ExternalLink href={s.source_url} className="mt-1 inline-block text-meta">{new URL(s.source_url).hostname.replace(/^www./, "")}</ExternalLink>}
              </figure>
            )}
          </Card>
        </Section>
      )}

      <Section title={t("coverageTitle")}>
        <Card>
          <p>{pick(s.coverage, "summary", locale)}</p>
        </Card>
      </Section>

      <Section title={t("eligibilityTitle")}>
        <Card className="space-y-3">
          <p>{pick(s, "eligibility_summary", locale)}</p>
          {s.type === "need" ? (
            <p className="flex gap-2 text-meta text-ink-muted">
              <Icon name="info" className="size-4 shrink-0" /> {fit("needBasedLong")}
            </p>
          ) : (
            s.evaluates.length > 0 && (
              <div>
                <h3 className="font-semibold">{t("evaluates")}</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {s.evaluates.map((e) => (
                    <li key={e}>
                      <Badge tone="primary">{labels(`evaluates.${e}`)}</Badge>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-meta text-ink-muted">{t("evaluatesNote")}</p>
              </div>
            )
          )}
        </Card>
      </Section>

      <Section title={t("appliesTo")}>
        <Card className="space-y-3">
          {(countries.length > 0 || universities.length > 0) && (
            <ul className="flex flex-wrap gap-2">
              {countries.map((c) => (
                <li key={c.slug}>
                  <Link href={`/countries/${c.slug}`} className="inline-flex min-h-tap items-center rounded-full bg-surface-2 px-4 text-meta font-semibold hover:underline">
                    {locale === "bn" ? c.name_bn : c.name_en}
                  </Link>
                </li>
              ))}
              {universities.map((u) => (
                <li key={u.slug}>
                  <Link href={`/universities/${u.slug}`} className="inline-flex min-h-tap items-center rounded-full bg-surface-2 px-4 text-meta font-semibold hover:underline">
                    {u.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="text-meta text-ink-muted">{t("programCount", { count: applies.length })}</p>
          <ul className="divide-y divide-border">
            {applies.map(({ program, university }) => (
              <li key={program.slug}>
                <Link href={`/programs/${program.slug}`} className="flex min-h-tap items-center justify-between gap-2 py-2 hover:underline">
                  <span>
                    <span className="block font-semibold">{program.title}</span>
                    <span className="text-meta text-ink-muted">{university.name}</span>
                  </span>
                  <Icon name="chevronRight" className="shrink-0 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Card className="flex flex-col gap-1">
        <p className="text-meta text-ink-muted">{common("verifiedOn", { date: formatDate(s.last_verified, locale) })}</p>
        <ExternalLink href={s.official_url}>{t("officialLink")}</ExternalLink>
      </Card>
    </div>
  );
}
