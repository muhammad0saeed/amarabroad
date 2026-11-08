import { describe, expect, it } from "vitest";
import { normalizeWords, TextIndex, withinOneEdit } from "@/lib/textIndex";

const items = [
  { parts: [{ text: "MSc Computer Science", weight: 3 }, { text: "TU Munich", weight: 2 }, { text: "München Germany জার্মানি", weight: 1 }] },
  { parts: [{ text: "Bachelor of Civil Engineering", weight: 3 }, { text: "University of Milan", weight: 2 }, { text: "Milan Italy", weight: 1 }] },
  { parts: [{ text: "MBA", weight: 3 }, { text: "Computer Business School", weight: 2 }, { text: "Paris France", weight: 1 }] },
];

describe("text index", () => {
  const index = new TextIndex(items);

  it("splits and lowercases words, dropping accents but keeping Bangla", () => {
    expect(normalizeWords("München, Côte-d'Ivoire জার্মানি")).toEqual(["munchen", "cote", "d", "ivoire", "জার্মানি"]);
  });

  it("knows one-letter typos", () => {
    expect(withinOneEdit("enginering", "engineering")).toBe(true);
    expect(withinOneEdit("compuetr", "computer")).toBe(true);
    expect(withinOneEdit("science", "silence")).toBe(false);
  });

  it("needs every word to match, title hits first", () => {
    expect(index.search("computer")).toEqual([0, 2]);
    expect(index.search("computer science")).toEqual([0]);
    expect(index.search("computer paris")).toEqual([2]);
  });

  it("matches word starts, typos, places and Bangla", () => {
    expect(index.search("comp sci")).toEqual([0]);
    expect(index.search("enginering")).toEqual([1]);
    expect(index.search("munchen")).toEqual([0]);
    expect(index.search("জার্মানি")).toEqual([0]);
  });

  it("returns nothing for empty or unknown queries", () => {
    expect(index.search("   ")).toEqual([]);
    expect(index.search("astrophysics")).toEqual([]);
  });

  it("answers fast with many programs", () => {
    const many = Array.from({ length: 30000 }, (_, i) => ({ parts: [{ text: `Program ${i} in subject${i % 300} studies`, weight: 3 }, { text: `University number${i % 2000}`, weight: 2 }] }));
    const big = new TextIndex(many);
    const start = performance.now();
    // Words with digits get no typo matches (subject41, subject43 stay out).
    const hits = big.search("subject42 studies");
    expect(hits.length).toBe(100);
    expect(performance.now() - start).toBeLessThan(500);
  });
});
