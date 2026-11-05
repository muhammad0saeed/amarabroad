import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { moderateOutcome } from "../actions";
import { ActionButton, Empty, PageTitle, Tabs, when } from "../ui";

export const metadata: Metadata = { title: "Outcomes" };

const STATUSES = ["pending", "approved", "rejected"] as const;
type Status = (typeof STATUSES)[number];
const TESTS: Record<string, string> = { ielts: "IELTS", toefl_ibt: "TOEFL iBT", pte: "PTE", duolingo: "Duolingo", moi: "Medium of instruction" };
const UNI: Record<string, string> = { public: "public uni", private: "private uni", nu: "National University" };

export default async function OutcomesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const status: Status = STATUSES.includes(sp.status as Status) ? (sp.status as Status) : "pending";
  const counts = await Promise.all(
    STATUSES.map(async (s) => (await db.from("outcome_reports").select("id", { count: "exact", head: true }).eq("status", s)).count ?? 0),
  );
  const { data } = await db
    .from("outcome_reports")
    .select("id, created_at, program, intake, result, cgpa, cgpa_scale, degree, university_type, english_test, english_score, experience_months, tips, programs(title)")
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(100);
  const href = (s: string) => `/admin/outcomes/?status=${s}`;

  return (
    <>
      <PageTitle
        title="Outcomes"
        hint="Students' admission results. Approve only believable ones: the grades and test scores must make sense, and the tips must not name or identify anyone."
      />
      <Tabs active={href(status)} items={STATUSES.map((s, i) => ({ href: href(s), label: s.charAt(0).toUpperCase() + s.slice(1), count: counts[i] }))} />
      {!data?.length ? (
        <Empty>No {status} outcomes.</Empty>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {data.map((o) => {
            const title = (o.programs as unknown as { title: string } | null)?.title;
            const odd = o.cgpa > o.cgpa_scale || (o.english_test === "ielts" && o.english_score !== null && o.english_score > 9);
            return (
              <li key={o.id} className="py-4">
                <p className="text-meta text-ink-muted">
                  {when(o.created_at)} ·{" "}
                  {o.program ? (
                    <Link href={`/en/programs/${o.program}/`} className="underline hover:text-ink" target="_blank">
                      {title ?? o.program}
                    </Link>
                  ) : (
                    "program removed"
                  )}{" "}
                  · intake {o.intake}
                </p>
                <p className="mt-1.5">
                  <span className={`font-bold ${o.result === "admitted" ? "text-success" : o.result === "rejected" ? "text-danger" : "text-warning"}`}>
                    {o.result.charAt(0).toUpperCase() + o.result.slice(1)}
                  </span>{" "}
                  with CGPA {o.cgpa}/{o.cgpa_scale}, {o.degree} ({UNI[o.university_type] ?? o.university_type}), {TESTS[o.english_test] ?? o.english_test}
                  {o.english_score !== null && ` ${o.english_score}`}
                  {o.experience_months ? `, ${o.experience_months} months' work` : ""}
                </p>
                {odd && <p className="mt-1 text-meta font-semibold text-warning">Numbers look wrong: check before approving.</p>}
                {o.tips && <blockquote className="mt-2 max-w-[75ch] border-l-2 border-border pl-3 whitespace-pre-wrap text-ink-muted">{o.tips}</blockquote>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {status !== "approved" && (
                    <ActionButton action={moderateOutcome} fields={{ id: o.id, status: "approved" }} tone="good">
                      Approve
                    </ActionButton>
                  )}
                  {status !== "rejected" && (
                    <ActionButton action={moderateOutcome} fields={{ id: o.id, status: "rejected" }} tone="bad">
                      Reject
                    </ActionButton>
                  )}
                  {status !== "pending" && (
                    <ActionButton action={moderateOutcome} fields={{ id: o.id, status: "pending" }}>
                      Back to pending
                    </ActionButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
