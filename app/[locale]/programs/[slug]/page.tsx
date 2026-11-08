import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FitScoreCard, ScholarshipFitBadge } from "@/components/fit/FitScore";
import { OutcomeReport, WrongInfoReport } from "@/components/forms/ReportForms";
import { GROUP_ICON, Icon } from "@/components/icons";
import { ParentSummary } from "@/components/program/ParentSummary";
import { ProgramPageActions } from "@/components/program/ProgramActions";
import { ProgramChat } from "@/components/program/ProgramChat";
import { AddToCalendar } from "@/components/ui/AddToCalendar";
import { DaysLeft } from "@/components/ui/DaysLeft";
import { Badge, Breadcrumbs, buttonClass, Card, Disclosure, ExternalLink, Section } from "@/components/ui/primitives";
import { NotFound } from "@/components/ui/NotFound";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { programCost } from "@/lib/cost";
import { DATA_SOURCE, getProgramContext, hasGuide, listPrograms, listScholarshipsForProgram } from "@/lib/data";
import { formatDate, formatMonthYear } from "@/lib/format";
import { formatNumber, isFallback, localizeDigits, pick, pickList, type AppLocale } from "@/lib/localize";
import { formatBDT, formatMoney } from "@/lib/money";
import { getFieldInfo, getFieldNames, getFitContext, getRates, initPage } from "@/lib/server";
import { site } from "@/lib/site";
import { countryHref, cityHref } from "@/lib/places";

type Props = { params: Promise<{ locale: string; slug: string }> };

// Live data: pages are made on first visit and kept for 10 minutes. Sample data: all made at build time.
export const dynamicParams = true;
export const revalidate = 600;

export async function generateStaticParams() {
  if (DATA_SOURCE === "supabase") return [];
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
  // Robot-read programs: the exact words on the official page behind each fact.
  const evidence = DATA_SOURCE === "supabase" && p.origin === "robot" ? await (await import("@/lib/supabase/evidence")).getEvidence(p.slug) : {};
  const sources = await getTranslations("sources");
  const fitContext = await getFitContext();
  const fieldNames = await getFieldNames();
  const field = (await getFieldInfo())[p.field];
  const L = locale as AppLocale;
  const cityName = L === "bn" ? city.name_bn : city.name_en;
  const countryName = L === "bn" ? country.name_bn : country.name_en;
  const num = (v: number) => formatNumber(v, L, 2);
  const langReq = (L === "bn" && p.language_requirement_bn) || p.language_requirement_en;
  // Languages beyond the ones we have labels for (the robot finds French, Dutch…) show their code.
  const languageName = (code: string) => (labels.has(`lang.${code}`) ? labels(`lang.${code}`) : code.toUpperCase());

  // Bangla summary for parents, always in Bangla.
  const bn = await getTranslations({ locale: "bn", namespace: "parent" });
  const bnLabels = await getTranslations({ locale: "bn", namespace: "labels" });
  const bnYes = (v: boolean | null) => (v === null ? bn("notStated") : bn(v ? "yes" : "no"));
  const latest = [...p.intakes].sort((a, b) => (a.deadline < b.deadline ? -1 : 1)).at(-1);
  const ielts = p.english_tests.find((e) => e.test === "ielts");
  // Lines for the facts we have, and one honest line for the rest (never a guessed value).
  const missing =
    p.duration_months === null || cost.bdt.total === null || p.tuition_per_year === null || !p.min_gpa_requirement || !latest || (!ielts && !p.language_requirement_bn);
  const parentText = [
    `${p.title} — ${u.name}, ${city.name_bn}, ${country.name_bn}`,
    p.duration_months !== null ? bn("line.level", { level: bnLabels(`level.${p.degree_level}`), months: localizeDigits(String(p.duration_months), "bn") }) : "",
    cost.bdt.total !== null && cost.bdt.firstYear !== null ? bn("line.total", { total: formatBDT(cost.bdt.total, "bn"), firstYear: formatBDT(cost.bdt.firstYear, "bn") }) : "",
    p.tuition_per_year === 0 ? bn("line.tuitionFree") : cost.bdt.tuitionPerYear !== null ? bn("line.tuition", { amount: formatBDT(cost.bdt.tuitionPerYear, "bn") }) : "",
    p.min_gpa_requirement ? bn("line.grade", { value: formatNumber(p.min_gpa_requirement.value, "bn", 2), scale: formatNumber(p.min_gpa_requirement.scale, "bn") }) : "",
    ielts ? bn("line.english", { score: formatNumber(ielts.min_score, "bn"), moi: bnYes(p.accepts_moi) }) : p.language_requirement_bn ? bn("line.otherLanguage", { requirement: p.language_requirement_bn }) : "",
    p.degree_level === "master" ? bn("line.threeYear", { answer: bnYes(p.accepts_3yr_bachelor) }) : "",
    latest ? bn("line.deadline", { date: formatDate(latest.deadline, "bn") }) : "",
    missing ? bn("line.missing") : "",
    bn("line.warning"),
    p.official_url,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="space-y-6 pb-4">
      <header className="pt-2">
        <Breadcrumbs
          label={common("breadcrumb")}
          items={[
            { href: countryHref(country), label: countryName },
            { href: cityHref(city), label: cityName },
            { href: `/universities/${u.slug}`, label: u.name },
          ]}
        />
        {city.photo && (
          <div className="relative mt-2 aspect-[16/7] overflow-hidden rounded-card bg-surface-2 sm:aspect-[21/7] lite:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP */}
            <img src={city.photo.src} alt="" width={960} height={640} fetchPriority="high" className="absolute inset-0 size-full object-cover" />
            <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-black/45 to-transparent" />
            <p className="absolute right-3 bottom-2 text-[0.6875rem] text-white/80">
              {cityName} · {common("photoCredit", { credit: city.photo.credit })}
            </p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-muted">
          {field && (
            <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-surface-2 text-ink">
              <Icon name={GROUP_ICON[field.group]} className="size-4" />
            </span>
          )}
          <span>
            {labels(`level.${p.degree_level}`)}
            {field && ` · ${L === "bn" ? field.name.bn : field.name.en}`}
          </span>
          <SampleBadge className="ml-auto" />
        </div>
        <h1 className="mt-2 text-title leading-tight font-bold tracking-tight text-balance sm:text-display">{p.title}</h1>
        <p className="mt-2 text-ink-muted">
          <Link href={`/universities/${u.slug}`} className="font-semibold text-ink hover:underline">
            {u.name}
          </Link>{" "}
          · {cityName}, {countryName}
        </p>
        <p className="mt-1 inline-flex items-center gap-1 text-meta text-ink-muted">
          <Icon name="clock" className="size-4" /> {t("verifiedOn", { date: formatDate(p.last_verified, L) })}
        </p>
      </header>

      <section aria-label={t("totalCost")} className="overflow-hidden rounded-card bg-surface shadow-card">
        <div className="p-5">
          <p className="text-meta text-ink-muted">{t("totalCost")}</p>
          {cost.bdt.total !== null && cost.bdt.firstYear !== null ? (
            <>
              <p className="mt-1 text-[2.25rem] leading-none font-bold tracking-[-0.03em] tabular-nums">{formatBDT(cost.bdt.total, L)}</p>
              <p className="mt-2 text-meta text-ink-muted">{t("firstYear", { amount: formatBDT(cost.bdt.firstYear, L) })}</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-heading font-bold">{common("costUnknown")}</p>
              {/* Say exactly why, so nobody reads a partial number as the full cost. */}
              <p className="mt-1 text-meta text-ink-muted">{cost.gaps.map((g) => common(`costGap.${g}`)).join(" · ")}</p>
            </>
          )}
        </div>
        <dl className="grid grid-cols-3 divide-x divide-border border-t border-border text-meta">
          <div className="p-3 sm:p-4">
            <dt className="text-ink-muted">{t("tuitionPerYear")}</dt>
            {p.tuition_per_year === null || p.currency === null ? (
              <dd className="mt-0.5"><NotFound /></dd>
            ) : (
              <>
                <dd className="mt-0.5 font-semibold">{p.tuition_per_year === 0 ? t("tuitionFree") : cost.bdt.tuitionPerYear !== null ? formatBDT(cost.bdt.tuitionPerYear, L) : formatMoney(p.tuition_per_year, p.currency, L)}</dd>
                {p.tuition_per_year !== 0 && cost.bdt.tuitionPerYear !== null && <dd className="text-ink-muted">{formatMoney(p.tuition_per_year, p.currency, L)}</dd>}
              </>
            )}
          </div>
          <div className="p-3 sm:p-4">
            <dt className="text-ink-muted">{t("duration")}</dt>
            <dd className="mt-0.5 font-semibold">{p.duration_months === null ? <NotFound /> : t("months", { count: p.duration_months })}</dd>
            {p.ects_credits !== null && <dd className="text-ink-muted">{localizeDigits(String(p.ects_credits), L)} ECTS</dd>}
          </div>
          <div className="p-3 sm:p-4">
            <dt className="text-ink-muted">{t("teaching")}</dt>
            <dd className="mt-0.5 font-semibold">{p.language === null ? <NotFound /> : languageName(p.language)}</dd>
            {langReq && <dd className="line-clamp-2 text-ink-muted">{langReq}</dd>}
          </div>
        </dl>
      </section>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          // ok: true = stated yes, false = stated no, null = the official page doesn't say.
          ...(p.degree_level === "master" ? [{ ok: p.accepts_3yr_bachelor, label: t(p.accepts_3yr_bachelor === null ? "tag3yrUnknown" : p.accepts_3yr_bachelor ? "tag3yr" : "tagNo3yr") }] : []),
          { ok: p.accepts_moi, label: t(p.accepts_moi === null ? "tagMoiUnknown" : p.accepts_moi ? "tagMoi" : "tagNoMoi") },
          { ok: p.accepts_provisional, label: t(p.accepts_provisional === null ? "tagProvisionalUnknown" : p.accepts_provisional ? "tagProvisional" : "tagNoProvisional") },
          { ok: p.open_to_bd_citizens, label: t(p.open_to_bd_citizens ? "tagBd" : "tagNotBd") },
        ].map((r) => (
          <li key={r.label} className="flex min-h-tap items-center gap-3 rounded-tile bg-surface px-3 py-2 shadow-card">
            <span className={`grid size-7 shrink-0 place-items-center rounded-full ${r.ok ? "bg-success-soft text-success" : "bg-surface-2 text-ink-muted"}`}>
              <Icon name={r.ok === null ? "info" : r.ok ? "check" : "close"} className="size-4" weight="bold" />
            </span>
            <span className={r.ok ? "font-medium" : "text-ink-muted"}>{r.label}</span>
          </li>
        ))}
      </ul>

      {Object.keys(evidence).length > 0 && (
        <Disclosure
          id="sources"
          summary={
            <span className="flex items-center gap-2">
              <Icon name="checkCircle" className="size-5 text-accent" />
              {sources("title")} <span className="text-ink-muted">({localizeDigits(String(Object.keys(evidence).length), L)})</span>
            </span>
          }
        >
          <p className="text-meta text-ink-muted">{sources("intro")}</p>
          <dl className="mt-3 divide-y divide-border">
            {Object.entries(evidence).map(([field, e]) => (
              <div key={field} className="py-3">
                <dt className="text-meta font-semibold">{sources.has(`field.${field}`) ? sources(`field.${field}`) : field}</dt>
                <dd className="mt-1 text-meta">
                  <q className="text-ink">{e.quote}</q>
                </dd>
                <dd className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.75rem] text-ink-muted">
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-ink hover:underline">
                    {new URL(e.url).hostname.replace(/^www\./, "")}
                  </a>
                  <span>· {sources("checked", { date: formatDate(e.date, L) })}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Disclosure>
      )}

      {/* Main action: students apply on the university's own program page, never through us. */}
      <div className="space-y-1.5">
        <a href={p.official_url} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "md", true)}>
          {t("applyCta")}
          <Icon name="external" className="size-4" />
        </a>
        <p className="text-center text-meta text-ink-muted">{t("applyNote", { host: new URL(p.official_url).hostname.replace(/^www\./, "") })}</p>
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
              {p.min_gpa_requirement ? (
                <>
                  {num(p.min_gpa_requirement.value)} / {num(p.min_gpa_requirement.scale)}
                  {p.min_gpa_requirement.local_note_en && <span className="text-ink-muted"> · {(L === "bn" && p.min_gpa_requirement.local_note_bn) || p.min_gpa_requirement.local_note_en}</span>}
                </>
              ) : (
                <NotFound long />
              )}
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
              {(
                [
                  [
                    cost.years !== null ? t("costTuition", { years: formatNumber(cost.years, L) }) : t("tuitionPerYear"),
                    cost.bdt.tuition,
                    cost.tuitionTotal !== null && p.currency ? formatMoney(cost.tuitionTotal, p.currency, L) : null,
                  ],
                  ...(cost.feesTotal ? [[t("costFees"), cost.bdt.fees, formatMoney(cost.feesTotal, p.currency ?? country.currency, L)] as const] : []),
                  [t("costApplication"), cost.bdt.application, formatMoney(p.application_fee, p.currency ?? country.currency, L)],
                  [
                    p.duration_months !== null && cost.bdt.livingMonthly !== null
                      ? cost.bdt.livingMonthlyMax !== null && cost.bdt.livingMonthlyMax > cost.bdt.livingMonthly
                        ? t("costLivingRange", { months: localizeDigits(String(p.duration_months), L), min: formatBDT(cost.bdt.livingMonthly, L), max: formatBDT(cost.bdt.livingMonthlyMax, L) })
                        : t("costLiving", { months: localizeDigits(String(p.duration_months), L), monthly: formatBDT(cost.bdt.livingMonthly, L) })
                      : t("costLivingShort"),
                    cost.bdt.living,
                    cost.livingTotal !== null ? formatMoney(cost.livingTotal, country.currency, L) : null,
                    cost.bdt.livingMax !== null && cost.bdt.living !== null && cost.bdt.livingMax > cost.bdt.living ? cost.bdt.livingMax : null,
                  ],
                ] as const
              ).map(([label, bdt, local, bdtMax]) => (
                <tr key={String(label)}>
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    {label}
                  </th>
                  <td className="py-2 text-right">
                    {bdt === null ? (
                      <NotFound />
                    ) : (
                      <>
                        <span className="font-semibold">
                          {formatBDT(bdt, L)}
                          {bdtMax ? ` – ${formatBDT(bdtMax, L)}` : ""}
                        </span>
                        {local && !bdtMax && <span className="block text-ink-muted">{local}</span>}
                      </>
                    )}
                  </td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="py-2 pr-3 text-left font-semibold">
                  {t("totalCost")}
                </th>
                <td className="py-2 text-right text-body font-bold">
                  {cost.bdt.total !== null ? (
                    <>
                      {formatBDT(cost.bdt.total, L)}
                      {cost.bdt.totalMax !== null && cost.bdt.totalMax > cost.bdt.total && ` – ${formatBDT(cost.bdt.totalMax, L)}`}
                    </>
                  ) : (
                    <span className="text-meta font-normal text-ink-muted">{common("costUnknown")}</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="mt-3 space-y-1 text-meta text-ink-muted">
            {cost.livingFrom === "country" && country.living_cost_min ? (
              <p>
                {t("costLivingBasis", {
                  min: formatMoney(country.living_cost_min, country.currency, L),
                  minBasis: (L === "bn" ? country.living_cost_min_basis_bn : null) ?? country.living_cost_min_basis_en ?? "",
                  max: formatMoney(country.living_cost_max ?? country.living_cost_min, country.currency, L),
                  maxBasis: (L === "bn" ? country.living_cost_max_basis_bn : null) ?? country.living_cost_max_basis_en ?? t("costMaxEstimate"),
                })}{" "}
                {country.living_cost_source_url && <ExternalLink href={country.living_cost_source_url}>{t("costSource")}</ExternalLink>}
              </p>
            ) : cost.livingFrom === null ? (
              <p>{t("costLivingMissing", { country: countryName })}</p>
            ) : null}
            <p>
              {t("costNote")}
              {hasGuide(city) && (
                <>
                  {" "}
                  <Link href={cityHref(city)} className="font-semibold text-primary-ink hover:underline">
                    {t("cityGuide", { city: cityName })}
                  </Link>
                </>
              )}
            </p>
          </div>
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
