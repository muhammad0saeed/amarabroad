import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FitScoreCard, ScholarshipFitBadge } from "@/components/fit/FitScore";
import { OutcomeReport, WrongInfoReport } from "@/components/forms/ReportForms";
import { Icon } from "@/components/icons";
import { ParentSummary } from "@/components/program/ParentSummary";
import { ProgramPageActions } from "@/components/program/ProgramActions";
import { ProgramChat } from "@/components/program/ProgramChat";
import { AddToCalendar } from "@/components/ui/AddToCalendar";
import { DaysLeft } from "@/components/ui/DaysLeft";
import { Badge, Breadcrumbs, Card, Disclosure, ExternalLink, Fact, IconTile, Section, YesNoTag } from "@/components/ui/primitives";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { programCost } from "@/lib/cost";
import { getProgramContext, listPrograms, listScholarshipsForProgram } from "@/lib/data";
import { formatDate, formatMonthYear } from "@/lib/format";
import { formatNumber, isFallback, localizeDigits, pick, pickList, type AppLocale } from "@/lib/localize";
import { formatBDT, formatMoney } from "@/lib/money";
import { getFieldInfo, getFieldNames, getFitContext, getRates, initPage } from "@/lib/server";
import { site } from "@/lib/site";

type Props = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  const programs = await listPrograms();
  return routing.locales.flatMap((locale) => programs.map((p) => ({ locale, slug: p.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ctx = await getProgramContext(slug);
  return ctx ? { title: `${ctx.program.title} · ${ctx.university.name}`, description: ctx.program.overview_en } : {};
}

export default async function ProgramPage({ params }: Props) {
  const locale = await initPage(params);
  const { slug } = await params;
  const ctx = await getProgramContext(slug);
  if (!ctx) notFound();

  const { program: p, university: u, city, country } = ctx;
  const t = await getTranslations("program");
  const labels = await getTranslations("labels");
  const common = await getTranslations("common");
  const rates = await getRates();
  const cost = programCost(ctx, rates);
  const scholarships = await listScholarshipsForProgram(p.slug);
  const fitContext = await getFitContext();
  const fieldNames = await getFieldNames();
  const field = (await getFieldInfo())[p.field];
  const L = locale as AppLocale;
  const cityName = L === "bn" ? city.name_bn : city.name_en;
  const countryName = L === "bn" ? country.name_bn : country.name_en;
  const num = (v: number) => formatNumber(v, L, 2);
  const langReq = (L === "bn" && p.language_requirement_bn) || p.language_requirement_en;

  // Bangla summary for parents, always in Bangla.
  const bn = await getTranslations({ locale: "bn", namespace: "parent" });
  const bnLabels = await getTranslations({ locale: "bn", namespace: "labels" });
  const bnYes = (v: boolean) => bn(v ? "yes" : "no");
  const latest = [...p.intakes].sort((a, b) => (a.deadline < b.deadline ? -1 : 1)).at(-1)!;
  const ielts = p.english_tests.find((e) => e.test === "ielts");
  const parentText = [
    `${p.title} — ${u.name}, ${city.name_bn}, ${country.name_bn}`,
    bn("line.level", { level: bnLabels(`level.${p.degree_level}`), months: localizeDigits(String(p.duration_months), "bn") }),
    bn("line.total", { total: formatBDT(cost.bdt.total, "bn"), firstYear: formatBDT(cost.bdt.firstYear, "bn") }),
    p.tuition_per_year === 0 ? bn("line.tuitionFree") : bn("line.tuition", { amount: formatBDT(cost.bdt.tuitionPerYear, "bn") }),
    bn("line.grade", { value: formatNumber(p.min_gpa_requirement.value, "bn", 2), scale: formatNumber(p.min_gpa_requirement.scale, "bn") }),
    ielts ? bn("line.english", { score: formatNumber(ielts.min_score, "bn"), moi: bnYes(p.accepts_moi) }) : bn("line.otherLanguage", { requirement: p.language_requirement_bn ?? "" }),
    p.degree_level === "master" ? bn("line.threeYear", { answer: bnYes(p.accepts_3yr_bachelor) }) : "",
    bn("line.deadline", { date: formatDate(latest.deadline, "bn") }),
    bn("line.warning"),
    p.official_url,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="space-y-6 pb-4">
      <div className="pt-2">
        <Breadcrumbs
          label={common("breadcrumb")}
          items={[
            { href: `/countries/${country.slug}`, label: countryName },
            { href: `/cities/${city.slug}`, label: cityName },
            { href: `/universities/${u.slug}`, label: u.name },
          ]}
        />
        <div className="mt-2 flex items-start gap-3">
          <span className="lite:hidden">
            <IconTile tile={field?.tile} group={field?.group} size="lg" />
          </span>
          <div>
            <h1 className="text-title font-bold sm:text-display">{p.title}</h1>
            <p className="mt-1 text-ink-muted">
              <Link href={`/universities/${u.slug}`} className="font-semibold text-ink hover:underline">
                {u.name}
              </Link>{" "}
              · {cityName}, {countryName}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SampleBadge />
          <Badge tone="primary">{labels(`level.${p.degree_level}`)}</Badge>
          {field && <Badge>{L === "bn" ? field.name.bn : field.name.en}</Badge>}
          <Badge icon="clock">{t("verifiedOn", { date: formatDate(p.last_verified, L) })}</Badge>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label={t("totalCost")} value={formatBDT(cost.bdt.total, L)} hint={t("firstYear", { amount: formatBDT(cost.bdt.firstYear, L) })} />
        <Fact
          label={t("tuitionPerYear")}
          value={p.tuition_per_year === 0 ? t("tuitionFree") : formatBDT(cost.bdt.tuitionPerYear, L)}
          hint={p.tuition_per_year === 0 ? undefined : formatMoney(p.tuition_per_year, p.currency, L)}
        />
        <Fact label={t("duration")} value={t("months", { count: p.duration_months })} hint={`${localizeDigits(String(p.ects_credits), L)} ECTS`} />
        <Fact label={t("teaching")} value={labels(`lang.${p.language}`)} hint={langReq} />
      </dl>

      <div className="flex flex-wrap gap-2">
        {p.degree_level === "master" && <YesNoTag yes={p.accepts_3yr_bachelor}>{t(p.accepts_3yr_bachelor ? "tag3yr" : "tagNo3yr")}</YesNoTag>}
        <YesNoTag yes={p.accepts_moi}>{t(p.accepts_moi ? "tagMoi" : "tagNoMoi")}</YesNoTag>
        <YesNoTag yes={p.accepts_provisional}>{t(p.accepts_provisional ? "tagProvisional" : "tagNoProvisional")}</YesNoTag>
        <YesNoTag yes={p.open_to_bd_citizens}>{t(p.open_to_bd_citizens ? "tagBd" : "tagNotBd")}</YesNoTag>
      </div>

      <ProgramPageActions slug={p.slug} title={p.title} />

      <FitScoreCard program={p} ctx={fitContext} fieldNames={fieldNames} languageRequirement={langReq} />

      <Section title={t("overview")} id="overview">
        <Card>
          <p>{pick(p, "overview", L)}</p>
          {isFallback(p, "overview", L) && <p className="mt-2 text-meta text-ink-muted">{common("englishOnly")}</p>}
          <h3 className="mt-4 font-semibold">{t("careers")}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {pickList(p.career_paths_en, p.career_paths_bn, L).map((c) => (
              <li key={c}>
                <Badge>{c}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section title={t("requirements")} id="requirements">
        <Card className="space-y-4">
          <div>
            <h3 className="font-semibold">{t(p.degree_level === "bachelor" ? "minHsc" : "minCgpa")}</h3>
            <p className="mt-1">
              {num(p.min_gpa_requirement.value)} / {num(p.min_gpa_requirement.scale)}
              {p.min_gpa_requirement.local_note_en && <span className="text-ink-muted"> · {p.min_gpa_requirement.local_note_en}</span>}
            </p>
          </div>
          <div>
            <h3 className="font-semibold">{t("english")}</h3>
            {p.english_tests.length > 0 ? (
              <ul className="mt-1 flex flex-wrap gap-2">
                {p.english_tests.map((e) => (
                  <li key={e.test}>
                    <Badge tone="primary">
                      {labels(`test.${e.test}`)} {num(e.min_score)}
                    </Badge>
                  </li>
                ))}
                {p.accepts_moi && (
                  <li>
                    <Badge tone="success" icon="check">
                      {t("moiAccepted")}
                    </Badge>
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-1">{langReq}</p>
            )}
          </div>
          <div>
            <h3 className="font-semibold">{t("acceptedFields")}</h3>
            <p className="mt-1 text-meta text-ink-muted">
              {p.related_bachelor_fields.map((f) => (L === "bn" ? fieldNames[f]?.bn : fieldNames[f]?.en) ?? f).join(" · ")}
            </p>
          </div>
          <div>
            <h3 className="font-semibold">{t("documents")}</h3>
            <ul className="mt-1 grid gap-1 sm:grid-cols-2">
              {p.required_documents.map((d) => (
                <li key={d} className="flex items-center gap-2 text-meta">
                  <Icon name="check" className="size-4 text-success" /> {labels(`doc.${d}`)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold">{t("seats")}</h3>
            <p className="mt-1">
              {p.seats_non_eu === null ? (
                <Badge>{t("notPublished")}</Badge>
              ) : (
                t("seatsValue", { nonEu: localizeDigits(String(p.seats_non_eu), L), total: localizeDigits(String(p.seats_total ?? "—"), L) })
              )}
            </p>
          </div>
        </Card>
      </Section>

      <Section title={t("intakes")} id="intakes">
        <ul className="space-y-2">
          {p.intakes.map((i) => (
            <li key={i.deadline}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{t("intakeStarts", { month: formatMonthYear(i.month, i.year, L) })}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-meta text-ink-muted">
                    {t("applyBy", { date: formatDate(i.deadline, L) })} <DaysLeft date={i.deadline} />
                  </p>
                </div>
                <AddToCalendar
                  fileSlug={`${p.slug}-${i.year}-${i.month}`}
                  event={{
                    uid: `program-${p.slug}-${i.year}-${i.month}@amarabroad`,
                    title: t("calendarTitle", { title: p.title }),
                    description: `${u.name}. ${common("calendarNote")}`,
                    url: p.official_url,
                    date: i.deadline,
                  }}
                />
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("costTitle")} id="cost">
        <Card>
          <table className="w-full text-meta">
            <caption className="sr-only">{t("costTitle")}</caption>
            <tbody className="divide-y divide-border">
              {[
                [t("costTuition", { years: formatNumber(cost.years, L) }), cost.bdt.tuition, formatMoney(cost.tuitionTotal, p.currency, L)],
                ...(cost.feesTotal ? [[t("costFees"), cost.bdt.fees, formatMoney(cost.feesTotal, p.currency, L)] as const] : []),
                [t("costApplication"), cost.bdt.application, formatMoney(p.application_fee, p.currency, L)],
                [
                  t("costLiving", { months: localizeDigits(String(p.duration_months), L), monthly: formatBDT(cost.bdt.livingMonthly, L) }),
                  cost.bdt.living,
                  formatMoney(cost.livingTotal, country.currency, L),
                ],
              ].map(([label, bdt, local]) => (
                <tr key={String(label)}>
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    {label}
                  </th>
                  <td className="py-2 text-right">
                    <span className="font-semibold">{formatBDT(Number(bdt), L)}</span>
                    <span className="block text-ink-muted">{local}</span>
                  </td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="py-2 pr-3 text-left font-semibold">
                  {t("totalCost")}
                </th>
                <td className="py-2 text-right text-body font-bold">{formatBDT(cost.bdt.total, L)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-meta text-ink-muted">
            {t("costNote")}{" "}
            <Link href={`/cities/${city.slug}`} className="font-semibold text-primary-ink hover:underline">
              {t("cityGuide", { city: cityName })}
            </Link>
          </p>
        </Card>
      </Section>

      <Section title={t("scholarships")} id="scholarships">
        {scholarships.length === 0 ? (
          <p className="text-ink-muted">{t("noScholarships")}</p>
        ) : (
          <ul className="space-y-2">
            {scholarships.map((s) => (
              <li key={s.slug}>
                <Card className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link href={`/scholarships/${s.slug}`} className="font-semibold hover:underline">
                      {s.name}
                    </Link>
                    <ScholarshipFitBadge scholarship={s} program={p} ctx={fitContext} />
                  </div>
                  <p className="text-meta text-ink-muted">{pick(s.coverage, "summary", L)}</p>
                  <p className="flex flex-wrap items-center gap-2 text-meta">
                    <Badge tone={s.type === "need" ? "neutral" : "primary"}>{labels(`scholarshipType.${s.type}`)}</Badge>
                    {!s.bd_eligible && <Badge tone="danger">{t("tagNotBd")}</Badge>}
                    {t("applyBy", { date: formatDate(s.deadline, L) })} <DaysLeft date={s.deadline} />
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <ProgramChat
        ctx={ctx}
        scholarshipNames={scholarships.map((s) => s.name)}
        cost={{
          totalBDT: cost.bdt.total,
          firstYearBDT: cost.bdt.firstYear,
          livingMonthly: cost.livingMonthly,
          livingMonthlyBDT: cost.bdt.livingMonthly,
          tuitionPerYearBDT: cost.bdt.tuitionPerYear,
        }}
      />

      <ParentSummary text={parentText} title={`${p.title} — ${site.name}`} />

      <Card className="flex flex-col gap-1">
        <h2 className="font-semibold">{t("officialTitle")}</h2>
        <p className="text-meta text-ink-muted">{t("officialBody", { date: formatDate(p.last_verified, L) })}</p>
        <ExternalLink href={p.official_url}>{t("officialLink")}</ExternalLink>
      </Card>

      <div className="space-y-3">
        <Disclosure summary={t("reportWrong")} id="report">
          <WrongInfoReport programSlug={p.slug} />
        </Disclosure>
        <Disclosure summary={t("shareResult")} id="share-result">
          <OutcomeReport programSlug={p.slug} />
        </Disclosure>
      </div>
    </div>
  );
}
