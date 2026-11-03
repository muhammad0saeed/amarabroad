// Validation for the three report forms. Stage 1 validates fully but never sends:
// on submit the UI shows "Preview mode: not sent". Error codes map to messages/*.json.

export type FieldError = "required" | "too_short" | "too_long" | "invalid_email" | "invalid_url" | "invalid_number" | "out_of_range" | "invalid_choice";
export type Errors<T> = Partial<Record<keyof T, FieldError>>;

export const LIMITS = { shortText: 120, description: 2000, tips: 1000, minDescription: 10 } as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function checkRequired(value: string): FieldError | undefined {
  return value.trim() === "" ? "required" : undefined;
}

export function checkLength(value: string, { min = 0, max }: { min?: number; max: number }): FieldError | undefined {
  const length = value.trim().length;
  if (length > 0 && length < min) return "too_short";
  if (length > max) return "too_long";
  return undefined;
}

export function checkEmail(value: string): FieldError | undefined {
  return value.trim() === "" || EMAIL.test(value.trim()) ? undefined : "invalid_email";
}

export function checkUrl(value: string): FieldError | undefined {
  if (value.trim() === "") return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? undefined : "invalid_url";
  } catch {
    return "invalid_url";
  }
}

export function checkNumber(value: string, { min, max, required = false }: { min: number; max: number; required?: boolean }): FieldError | undefined {
  if (value.trim() === "") return required ? "required" : undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return "invalid_number";
  return n < min || n > max ? "out_of_range" : undefined;
}

export function checkChoice<T extends string>(value: string, choices: readonly T[], required = true): FieldError | undefined {
  if (value === "") return required ? "required" : undefined;
  return choices.includes(value as T) ? undefined : "invalid_choice";
}

const firstError = (...checks: (FieldError | undefined)[]) => checks.find(Boolean);
function clean<T>(errors: Errors<T>): Errors<T> {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as Errors<T>;
}

// ---------------------------------------------------------------- Report wrong info (program page)

export const WRONG_INFO_TOPICS = ["tuition", "deadline", "requirements", "english", "seats", "scholarships", "link", "other"] as const;

export interface WrongInfoForm {
  topic: string;
  correction: string;
  sourceUrl: string;
  email: string;
}

export function validateWrongInfo(f: WrongInfoForm): Errors<WrongInfoForm> {
  return clean({
    topic: checkChoice(f.topic, WRONG_INFO_TOPICS),
    correction: firstError(checkRequired(f.correction), checkLength(f.correction, { min: LIMITS.minDescription, max: LIMITS.description })),
    sourceUrl: checkUrl(f.sourceUrl),
    email: checkEmail(f.email),
  });
}

// ---------------------------------------------------------------- Report a problem (menu and footer)

export const PROBLEM_TYPES = ["bug", "wrong_info", "page_not_loading", "suggestion"] as const;

export interface ProblemForm {
  type: string;
  description: string;
  email: string;
}

export function validateProblem(f: ProblemForm): Errors<ProblemForm> {
  return clean({
    type: checkChoice(f.type, PROBLEM_TYPES),
    description: firstError(checkRequired(f.description), checkLength(f.description, { min: LIMITS.minDescription, max: LIMITS.description })),
    email: checkEmail(f.email),
  });
}

/** Attached automatically to problem reports (shown to the student before sending). */
export function problemContext(pageUrl: string, userAgent: string, appVersion: string) {
  return { pageUrl, userAgent, appVersion };
}

// ---------------------------------------------------------------- Share your result (outcome report)

export const OUTCOME_RESULTS = ["admitted", "rejected", "waitlisted"] as const;
export const UNIVERSITY_TYPES = ["public", "private", "nu"] as const;
export const ENGLISH_TESTS = ["ielts", "toefl_ibt", "pte", "duolingo", "moi"] as const;
const ENGLISH_RANGES: Record<Exclude<(typeof ENGLISH_TESTS)[number], "moi">, [number, number]> = {
  ielts: [0, 9],
  toefl_ibt: [0, 120],
  pte: [10, 90],
  duolingo: [10, 160],
};

export interface OutcomeForm {
  intake: string;
  result: string;
  cgpa: string;
  cgpaScale: string;
  degree: string;
  universityType: string;
  englishTest: string;
  englishScore: string;
  experienceMonths: string;
  tips: string;
}

export function validateOutcome(f: OutcomeForm): Errors<OutcomeForm> {
  const scale = Number(f.cgpaScale) || 4;
  const range = f.englishTest && f.englishTest !== "moi" ? ENGLISH_RANGES[f.englishTest as keyof typeof ENGLISH_RANGES] : undefined;
  return clean({
    intake: firstError(checkRequired(f.intake), /^\d{4}-(0[1-9]|1[0-2])$/.test(f.intake.trim()) ? undefined : "invalid_choice"),
    result: checkChoice(f.result, OUTCOME_RESULTS),
    cgpaScale: checkChoice(f.cgpaScale, ["4", "5"] as const),
    cgpa: checkNumber(f.cgpa, { min: 0, max: scale, required: true }),
    degree: firstError(checkRequired(f.degree), checkLength(f.degree, { max: LIMITS.shortText })),
    universityType: checkChoice(f.universityType, UNIVERSITY_TYPES),
    englishTest: checkChoice(f.englishTest, ENGLISH_TESTS),
    englishScore: range ? checkNumber(f.englishScore, { min: range[0], max: range[1], required: true }) : undefined,
    experienceMonths: checkNumber(f.experienceMonths, { min: 0, max: 600 }),
    tips: checkLength(f.tips, { max: LIMITS.tips }),
  });
}

export const isValid = <T>(errors: Errors<T>) => Object.keys(errors).length === 0;
