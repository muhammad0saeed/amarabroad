"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { buttonClass, ExternalLink } from "@/components/ui/primitives";
import type { ChatAnswer, ChatIntent } from "@/lib/chat";
import { formatDate, formatMonthYear } from "@/lib/format";
import { formatNumber, localizeDigits, pickList, type AppLocale } from "@/lib/localize";
import { formatBDT, formatMoney } from "@/lib/money";
import { site } from "@/lib/site";
import type { ProgramContext } from "@/types";

// Same order as SUGGESTED_INTENTS in lib/chat (kept here so the chip row doesn't pull in Fuse.js).
const CHIPS: ChatIntent[] = ["tuition", "deadline", "english", "three_year", "moi", "seats", "documents", "scholarships"];

/** In taka; null = not known (the chat then says so instead of guessing). */
export interface ChatCost {
  totalBDT: number | null;
  firstYearBDT: number | null;
  livingMonthly: number | null;
  livingMonthlyBDT: number | null;
  tuitionPerYearBDT: number | null;
}

interface Turn {
  question: string;
  answer: ChatAnswer;
}

export function ProgramChat({ ctx, cost, scholarshipNames }: { ctx: ProgramContext; cost: ChatCost; scholarshipNames: string[] }) {
  const t = useTranslations("chat");
  const labels = useTranslations("labels");
  const locale = useLocale() as AppLocale;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const { program: p, university: u, city, country } = ctx;
  const yes = (v: boolean | null) => (v === null ? t("notFound") : t(v ? "yes" : "no"));
  const num = (v: number) => formatNumber(v, locale, 2);

  async function ask(question: string, intent?: ChatIntent) {
    const text = question.trim();
    if (!text) return;
    let answer: ChatAnswer;
    if (intent) answer = { type: "field", intent };
    else {
      const chat = await import("@/lib/chat");
      answer = chat.answerQuestion(text, ctx, scholarshipNames.length);
    }
    setTurns((list) => [...list, { question: text, answer }]);
    setInput("");
  }

  async function copy(index: number, question: string) {
    const chat = await import("@/lib/chat");
    try {
      await navigator.clipboard.writeText(chat.copyPrompt(question, ctx, site.name));
      setCopied(index);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      setCopied(null);
    }
  }

  const feeCurrency = p.currency ?? country.currency;
  function fieldAnswer(intent: ChatIntent): ReactNode {
    switch (intent) {
      case "tuition":
        if (p.tuition_per_year === null || p.currency === null) return t("notFound");
        return p.tuition_per_year === 0
          ? t("a.tuitionFree", { fees: formatMoney(p.other_fees_per_year, feeCurrency, locale) })
          : cost.tuitionPerYearBDT === null
            ? formatMoney(p.tuition_per_year, p.currency, locale)
            : t("a.tuition", { amount: formatMoney(p.tuition_per_year, p.currency, locale), bdt: formatBDT(cost.tuitionPerYearBDT, locale) });
      case "total_cost":
        if (cost.totalBDT === null || cost.firstYearBDT === null) return t("notFound");
        return t("a.totalCost", { total: formatBDT(cost.totalBDT, locale), firstYear: formatBDT(cost.firstYearBDT, locale) });
      case "living_cost":
        if (cost.livingMonthly === null || cost.livingMonthlyBDT === null) return t("notFound");
        return t("a.livingCost", {
          city: locale === "bn" ? city.name_bn : city.name_en,
          local: formatMoney(cost.livingMonthly, country.currency, locale),
          bdt: formatBDT(cost.livingMonthlyBDT, locale),
        });
      case "deadline":
      case "intake":
        if (p.intakes.length === 0) return t("notFound");
        return (
          <ul className="list-disc pl-5">
            {p.intakes.map((i) => (
              <li key={i.deadline}>{t("a.intake", { intake: formatMonthYear(i.month, i.year, locale), deadline: formatDate(i.deadline, locale) })}</li>
            ))}
          </ul>
        );
      case "duration":
        if (p.duration_months === null) return t("notFound");
        return t("a.duration", { months: localizeDigits(String(p.duration_months), locale), ects: localizeDigits(String(p.ects_credits ?? "—"), locale) });
      case "ects":
        if (p.ects_credits === null) return t("notFound");
        return t("a.ects", { ects: localizeDigits(String(p.ects_credits), locale) });
      case "english":
        if (p.english_tests.length === 0 && !p.language_requirement_en) return t("notFound");
        return p.english_tests.length === 0
          ? t("a.languageRequirement", { requirement: (locale === "bn" && p.language_requirement_bn) || p.language_requirement_en || "" })
          : t("a.english", { tests: p.english_tests.map((e) => `${labels(`test.${e.test}`)} ${num(e.min_score)}`).join(", "), moi: yes(p.accepts_moi) });
      case "moi":
        return p.accepts_moi === null ? t("notFound") : t(p.accepts_moi ? "a.moiYes" : "a.moiNo");
      case "three_year":
        return p.accepts_3yr_bachelor === null ? t("notFound") : t(p.accepts_3yr_bachelor ? "a.threeYearYes" : "a.threeYearNo");
      case "provisional":
        return p.accepts_provisional === null ? t("notFound") : t(p.accepts_provisional ? "a.provisionalYes" : "a.provisionalNo");
      case "seats":
        return p.seats_non_eu === null
          ? t("a.seatsUnknown")
          : t("a.seats", { nonEu: localizeDigits(String(p.seats_non_eu), locale), total: localizeDigits(String(p.seats_total ?? "—"), locale) });
      case "documents":
        if (p.required_documents.length === 0) return t("notFound");
        return (
          <ul className="list-disc pl-5">
            {p.required_documents.map((d) => (
              <li key={d}>{labels(`doc.${d}`)}</li>
            ))}
          </ul>
        );
      case "grade":
        if (!p.min_gpa_requirement) return t("notFound");
        return t("a.grade", { value: num(p.min_gpa_requirement.value), scale: num(p.min_gpa_requirement.scale) }) + (p.min_gpa_requirement.local_note_en ? ` (${(locale === "bn" && p.min_gpa_requirement.local_note_bn) || p.min_gpa_requirement.local_note_en})` : "");
      case "language":
        if (p.language === null) return t("notFound");
        return t("a.language", { language: labels.has(`lang.${p.language}`) ? labels(`lang.${p.language}`) : p.language.toUpperCase() }) + (p.language_requirement_en ? ` ${(locale === "bn" && p.language_requirement_bn) || p.language_requirement_en}.` : "");
      case "scholarships":
        return t("a.scholarships", { names: scholarshipNames.join(", ") });
      case "careers":
        return t("a.careers", { careers: pickList(p.career_paths_en, p.career_paths_bn, locale).join(", ") });
      case "work":
        if (country.student_work_hours === null) return t("notFound");
        return t("a.work", { hours: localizeDigits(String(country.student_work_hours), locale), country: locale === "bn" ? country.name_bn : country.name_en });
      case "application_fee":
        return t("a.applicationFee", { amount: formatMoney(p.application_fee, feeCurrency, locale) });
      case "ranking":
        return u.ranking ? t("a.ranking", { rank: localizeDigits(u.ranking.rank, locale), year: localizeDigits(String(u.ranking.year), locale), source: u.ranking.source }) : t("notFound");
      case "verified":
        return t("a.verified", { date: formatDate(p.last_verified, locale) });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <section aria-labelledby="chat-title" className="rounded-card bg-surface p-4 shadow-card sm:p-5">
      <h2 id="chat-title" className="flex items-center gap-2 text-heading font-semibold">
        <Icon name="chat" /> {t("title")}
      </h2>
      <p className="mt-1 text-meta text-ink-muted">{t("intro")}</p>

      <div className="-mx-1 mt-3 flex gap-2 no-scrollbar overflow-x-auto px-1 pb-1">
        {CHIPS.map((intent) => (
          <button
            key={intent}
            type="button"
            onClick={() => void ask(t(`q.${intent}`), intent === "scholarships" && scholarshipNames.length === 0 ? undefined : intent)}
            className="min-h-tap shrink-0 rounded-full border border-border bg-surface-2 px-4 text-meta font-semibold hover:border-primary"
          >
            {t(`q.${intent}`)}
          </button>
        ))}
      </div>

      <ol aria-live="polite" className="mt-3 space-y-3">
        {turns.map((turn, i) => (
          <li key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-on-primary">{turn.question}</p>
            <div className="w-fit max-w-[92%] rounded-2xl rounded-bl-md bg-surface-2 px-3 py-2">
              {turn.answer.type === "field" && fieldAnswer(turn.answer.intent)}
              {turn.answer.type === "search" && (
                <>
                  <p className="text-meta text-ink-muted">{t("fromOverview")}</p>
                  {turn.answer.sentences.map((s) => (
                    <p key={s} className="mt-1">
                      “{s}”
                    </p>
                  ))}
                </>
              )}
              {turn.answer.type === "none" && (
                <div className="space-y-2">
                  <p className="font-semibold">{t("notFound")}</p>
                  <ExternalLink href={p.official_url}>{t("officialPage")}</ExternalLink>
                  <button type="button" onClick={() => void copy(i, turn.question)} className={buttonClass("secondary", "sm", true)}>
                    <Icon name={copied === i ? "check" : "copy"} className="size-4" />
                    {t(copied === i ? "copied" : "copyForAi")}
                  </button>
                  <p className="text-meta text-ink-muted">{t("otherAiWarning")}</p>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      <form onSubmit={onSubmit} className="mt-3 flex gap-2">
        <label htmlFor="chat-input" className="sr-only">
          {t("inputLabel")}
        </label>
        <input
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("placeholder")}
          maxLength={300}
          className="min-h-tap flex-1 rounded-full border border-border bg-surface px-4 focus:border-primary focus:outline-none"
        />
        <button type="submit" aria-label={t("send")} className="grid size-tap shrink-0 place-items-center rounded-full bg-primary text-on-primary hover:bg-primary-hover">
          <Icon name="send" />
        </button>
      </form>
    </section>
  );
}
