// Backward timeline from an intake date: what to do, and by when, for a student applying from Bangladesh.
// Offsets are typical lead times, not official rules; the UI says to check each program and embassy.

import type { ISODate } from "@/types";
import { addDays, daysBetween, maxDate, minDate } from "./dates";

export type TimelineStepKey =
  | "shortlist"
  | "passport"
  | "english_book"
  | "english_take"
  | "documents"
  | "attestation"
  | "letters"
  | "scholarships"
  | "apply"
  | "offer"
  | "student_file"
  | "visa_appointment"
  | "visa_interview"
  | "accommodation"
  | "flight"
  | "arrive"
  | "residence_permit";

export interface TimelineInput {
  /** First day of teaching, e.g. "2027-09-01". */
  intakeStart: ISODate;
  /** The program's application deadline, if known. */
  applicationDeadline?: ISODate;
  /** A scholarship deadline to plan around, if any. */
  scholarshipDeadline?: ISODate;
  today: ISODate;
}

export interface TimelineStep {
  key: TimelineStepKey;
  date: ISODate;
  /** The date has passed: do it now. */
  late: boolean;
  /** Within the next 30 days. */
  soon: boolean;
}

/** Days before the intake, and (for preparation steps) days before submitting the application. */
const PREPARATION: { key: TimelineStepKey; beforeIntake: number; beforeApplying: number }[] = [
  { key: "shortlist", beforeIntake: 365, beforeApplying: 150 },
  { key: "passport", beforeIntake: 365, beforeApplying: 120 },
  { key: "english_book", beforeIntake: 300, beforeApplying: 100 },
  { key: "english_take", beforeIntake: 270, beforeApplying: 60 },
  { key: "documents", beforeIntake: 270, beforeApplying: 45 },
  { key: "attestation", beforeIntake: 240, beforeApplying: 30 },
  { key: "letters", beforeIntake: 240, beforeApplying: 21 },
];

export const TIMELINE_CONFIG = {
  defaultApplyBeforeIntake: 210,
  /** Submit this many days before the deadline, not on the last day. */
  submitEarlyDays: 14,
  offerAfterApplying: 60,
  latestOfferBeforeIntake: 100,
  studentFileAfterOffer: 14,
  visaAppointmentAfterOffer: 7,
  visaInterviewBeforeIntake: 90,
  accommodationBeforeIntake: 75,
  flightBeforeIntake: 30,
  arriveBeforeIntake: 10,
  residencePermitAfterIntake: 7,
  soonDays: 30,
} as const;

export function planTimeline(input: TimelineInput): TimelineStep[] {
  const C = TIMELINE_CONFIG;
  const { intakeStart, applicationDeadline, scholarshipDeadline, today } = input;
  const before = (days: number) => addDays(intakeStart, -days);

  const apply = applicationDeadline
    ? addDays(applicationDeadline, -C.submitEarlyDays)
    : before(C.defaultApplyBeforeIntake);
  // Preparation must be done before the earlier of the application and scholarship submissions.
  const scholarship = scholarshipDeadline ? addDays(scholarshipDeadline, -C.submitEarlyDays) : undefined;
  const firstSubmission = scholarship ? minDate(apply, scholarship) : apply;

  const offer = minDate(addDays(apply, C.offerAfterApplying), before(C.latestOfferBeforeIntake));
  const dates: [TimelineStepKey, ISODate][] = [
    ...PREPARATION.map(({ key, beforeIntake, beforeApplying }): [TimelineStepKey, ISODate] => [
      key,
      minDate(before(beforeIntake), addDays(firstSubmission, -beforeApplying)),
    ]),
    ...(scholarship ? ([["scholarships", scholarship]] as [TimelineStepKey, ISODate][]) : []),
    ["apply", apply],
    ["offer", offer],
    ["student_file", addDays(offer, C.studentFileAfterOffer)],
    ["visa_appointment", addDays(offer, C.visaAppointmentAfterOffer)],
    ["visa_interview", maxDate(before(C.visaInterviewBeforeIntake), addDays(offer, C.visaAppointmentAfterOffer + 1))],
    ["accommodation", before(C.accommodationBeforeIntake)],
    ["flight", before(C.flightBeforeIntake)],
    ["arrive", before(C.arriveBeforeIntake)],
    ["residence_permit", addDays(intakeStart, C.residencePermitAfterIntake)],
  ];

  return dates
    .map(([key, date]) => {
      const days = daysBetween(today, date);
      return { key, date, late: days < 0, soon: days >= 0 && days <= C.soonDays };
    })
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
}
