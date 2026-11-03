import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysBetween, monthStart, todayISO } from "@/lib/dates";
import { planTimeline } from "@/lib/timeline";

describe("dates", () => {
  it("does date-only arithmetic", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2027-09-15", -12)).toBe("2026-09-15");
    expect(daysBetween("2026-11-04", "2026-11-25")).toBe(21);
    expect(daysBetween("2026-11-04", "2026-10-15")).toBe(-20);
    expect(monthStart(9, 2027)).toBe("2027-09-01");
    expect(todayISO(new Date(2026, 10, 4, 23, 30))).toBe("2026-11-04");
  });
});

describe("timeline planner", () => {
  const plan = planTimeline({ intakeStart: "2027-09-01", applicationDeadline: "2027-03-31", today: "2026-11-04" });
  const step = (key: string, p = plan) => p.find((s) => s.key === key)!;

  it("plans backwards from the intake, in date order", () => {
    const dates = plan.map((s) => s.date);
    expect(dates).toEqual([...dates].sort());
    expect(plan[0]?.key).toBe("shortlist");
    expect(plan.at(-1)?.key).toBe("residence_permit");
  });

  it("submits two weeks before the deadline", () => {
    expect(step("apply").date).toBe("2027-03-17");
  });

  it("finishes preparation before applying", () => {
    for (const key of ["shortlist", "passport", "english_book", "english_take", "documents", "attestation", "letters"]) {
      expect(step(key).date < step("apply").date, key).toBe(true);
    }
    expect(step("english_take").date).toBe("2026-12-05"); // 270 days before 1 Sep 2027
    expect(step("letters").date).toBe("2027-01-04"); // 240 days before the intake
  });

  it("orders the steps after the offer", () => {
    expect(step("offer").date).toBe("2027-05-16"); // 60 days after applying
    expect(step("student_file").date).toBe("2027-05-30");
    expect(step("visa_appointment").date).toBe("2027-05-23");
    expect(step("visa_interview").date).toBe("2027-06-03"); // 90 days before the intake
    expect(step("arrive").date).toBe("2027-08-22");
    expect(step("residence_permit").date).toBe("2027-09-08");
  });

  it("flags steps that are already late or due within 30 days", () => {
    expect(step("shortlist")).toMatchObject({ date: "2026-09-01", late: true, soon: false });
    expect(step("passport").late).toBe(true);
    expect(step("english_book")).toMatchObject({ date: "2026-11-05", late: false, soon: true });
    expect(step("apply")).toMatchObject({ late: false, soon: false });
  });

  it("pulls preparation earlier for a scholarship deadline", () => {
    const withScholarship = planTimeline({
      intakeStart: "2027-09-01",
      applicationDeadline: "2027-03-31",
      scholarshipDeadline: "2026-12-10",
      today: "2026-11-04",
    });
    expect(step("scholarships", withScholarship)).toMatchObject({ date: "2026-11-26", soon: true });
    expect(step("letters", withScholarship).date).toBe("2026-11-05"); // 21 days before the scholarship submission
    expect(step("apply", withScholarship).date).toBe("2027-03-17");
  });

  it("works without a deadline (applies about 7 months before the intake)", () => {
    const noDeadline = planTimeline({ intakeStart: "2027-10-01", today: "2026-11-04" });
    expect(step("apply", noDeadline).date).toBe("2027-03-05");
  });
});
