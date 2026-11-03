// Grade conversion for Bangladeshi results (SSC/HSC GPA out of 5, CGPA out of 4).
// Every result is an estimate: each university may use its own method.

/** Lowest passing grade on Bangladeshi scales, used by the formula-based conversions. */
export const MIN_PASS: Record<number, number> = { 4: 2.0, 5: 1.0 };

export interface GradeInput {
  value: number;
  /** Maximum of the scale: 4 for CGPA, 5 for SSC/HSC GPA. */
  scale: number;
  /** Lowest passing grade; defaults to MIN_PASS for the scale. */
  minPass?: number;
}

export interface GradeConversion {
  fourPoint: number;
  fivePoint: number;
  percent: number;
  /** German scale, 1.0 (best) to 4.0 (pass); null when below the passing grade. */
  german: number | null;
  /** Italian degree grade, 66 to 110. */
  italian110: number | null;
  /** Hungarian scale, 2 (pass) to 5 (excellent). */
  hungarian5: number | null;
}

const round = (value: number, places: number) => Number(value.toFixed(places));

/** Linear rescale between scales, e.g. CGPA 3.5/4 → 4.38/5. */
export function rescale(value: number, fromScale: number, toScale: number): number {
  return (value / fromScale) * toScale;
}

export function toFourPoint(value: number, scale: number): number {
  return rescale(value, scale, 4);
}

/** Share of the passing range covered: 0 at the passing grade, 1 at the top. Null below pass. */
function positionInPassRange({ value, scale, minPass }: Required<GradeInput>): number | null {
  if (value < minPass - 1e-9 || value > scale + 1e-9) return null;
  return (value - minPass) / (scale - minPass);
}

/**
 * Modified Bavarian formula used by German universities:
 * German = 1 + 3 × (max − yours) / (max − pass), cut (not rounded) to one decimal.
 */
export function germanGrade(input: GradeInput): number | null {
  const full = withDefaults(input);
  if (positionInPassRange(full) === null) return null;
  const raw = 1 + (3 * (full.scale - full.value)) / (full.scale - full.minPass);
  return Math.min(4, Math.max(1, Math.floor(raw * 10 + 1e-9) / 10));
}

export function italianGrade110(input: GradeInput): number | null {
  const position = positionInPassRange(withDefaults(input));
  return position === null ? null : Math.round(66 + 44 * position);
}

export function hungarianGrade5(input: GradeInput): number | null {
  const position = positionInPassRange(withDefaults(input));
  return position === null ? null : round(2 + 3 * position, 2);
}

function withDefaults(input: GradeInput): Required<GradeInput> {
  return { ...input, minPass: input.minPass ?? MIN_PASS[input.scale] ?? 0 };
}

export function convertGrade(input: GradeInput): GradeConversion {
  return {
    fourPoint: round(rescale(input.value, input.scale, 4), 2),
    fivePoint: round(rescale(input.value, input.scale, 5), 2),
    percent: round((input.value / input.scale) * 100, 1),
    german: germanGrade(input),
    italian110: italianGrade110(input),
    hungarian5: hungarianGrade5(input),
  };
}
