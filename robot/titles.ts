// Program titles as pages write them ("Study the Bachelor of Nursing", "Master of Teaching : The University
// of Western Australia", "Bachelor of Midwifery (WMIDW2 – 2027)") versus official course lists ("Bachelor
// of Nursing"). cleanTitle tidies a page title for display; titleKey reduces both to the same key so the
// page and the list entry are recognised as one program.

const DEGREE = /\b(bachelor|master|msc|ma|mba|llm|meng|beng|bsc|ba|doctor|graduate (diploma|certificate)|diploma|associate degree)\b/i;
const INSTITUTION = /\b(universit(y|ät|é|à|eit|at)|college|institute|hochschule|school of|academy|polytechnic|campus|online)\b/i;

/** Tidies a page title: drops "Study the", the university name after ":" or "|", and course codes with years. */
export function cleanTitle(title: string): string {
  let t = title.replace(/\s+/g, " ").trim();
  t = t.replace(/^(study|discover|explore)\s+(the|a|an|our)?\s*/i, "");
  // "Master of X : The University of Y" / "… | University of Y": keep the part with the degree.
  const parts = t.split(/\s+[:|]\s+/);
  if (parts.length > 1) t = parts.filter((p) => !(INSTITUTION.test(p) && !DEGREE.test(p))).join(" : ") || parts[0]!;
  // "(WMIDW2 – 2027)", "(Course code 123)": codes and years in brackets aren't part of the name.
  t = t.replace(/\s*\((?=[^)]*\d)[^)]*\)\s*$/g, "").trim();
  return t;
}

/** A matching key: lowercase letters only, without campus/delivery suffixes, "honours" spellings unified. */
export function titleKey(title: string): string {
  let t = cleanTitle(title);
  // " – VU Sydney", " – Flinders Online": a campus or delivery mode after a dash, when it names no degree.
  t = t
    .split(/\s+[–—-]\s+/)
    .filter((p, i) => i === 0 || DEGREE.test(p) || !/^[A-Z]|online|campus/i.test(p))
    .join(" ");
  return t
    .toLowerCase()
    .replace(/\bhons\b/g, "honours")
    .replace(/&/g, " and ")
    .replace(/[^a-z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
