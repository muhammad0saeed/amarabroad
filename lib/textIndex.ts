// Fast word search over the program list: built once per data reload, answers in a few milliseconds
// even with tens of thousands of programs (the fuzzy library it replaces took 10+ seconds).
//
// Every word of the query must match a word in the program's title, university, subject, city or
// country (English or Bangla). A query word matches a program word that is the same, starts with it
// ("comp" → "computer"), or is one typo away when the word has 5+ letters and no digits ("enginering" → "engineering").

export interface IndexedText {
  /** Text with how much a hit on it counts (title 3, university/subject 2, place 1). */
  parts: { text: string; weight: number }[];
}

/** Lower case, accents and punctuation removed; Bangla letters kept. */
export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^\p{L}\p{N}\p{M}]+/u)
    .filter(Boolean);
}

/** True when a and b differ by at most one letter added, removed, changed or swapped with its neighbour. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    // One changed letter, or two neighbours swapped.
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

const EXACT = 1;
const PREFIX = 0.8;
const TYPO = 0.6;

export class TextIndex {
  /** Word → [item index, best weight of that word in the item]. */
  private postings = new Map<string, Map<number, number>>();
  private words: string[] = [];

  constructor(items: IndexedText[]) {
    items.forEach((item, idx) => {
      for (const { text, weight } of item.parts) {
        for (const w of normalizeWords(text)) {
          let list = this.postings.get(w);
          if (!list) this.postings.set(w, (list = new Map()));
          if ((list.get(idx) ?? 0) < weight) list.set(idx, weight);
        }
      }
    });
    this.words = [...this.postings.keys()];
  }

  /** Item indexes matching every query word, best first. */
  search(query: string): number[] {
    const queryWords = [...new Set(normalizeWords(query))];
    if (!queryWords.length) return [];
    let scores: Map<number, number> | null = null;
    for (const q of queryWords) {
      const hits = new Map<number, number>();
      const typos = q.length >= 5 && !/\d/.test(q);
      for (const w of this.words) {
        const kind = w === q ? EXACT : w.startsWith(q) ? PREFIX : typos && withinOneEdit(q, w) ? TYPO : 0;
        if (!kind) continue;
        for (const [idx, weight] of this.postings.get(w)!) {
          const s = kind * weight;
          if ((hits.get(idx) ?? 0) < s) hits.set(idx, s);
        }
      }
      if (scores === null) scores = hits;
      else {
        const next = new Map<number, number>();
        for (const [idx, s] of scores) {
          const h = hits.get(idx);
          if (h !== undefined) next.set(idx, s + h);
        }
        scores = next;
      }
      if (!scores.size) return [];
    }
    return [...scores!.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([idx]) => idx);
  }
}
