import { describe, expect, it } from "vitest";
import { convertGrade, germanGrade, hungarianGrade5, italianGrade110, rescale } from "@/lib/grades";

describe("grade converter", () => {
  it("uses the modified Bavarian formula for German grades, cut to one decimal", () => {
    expect(germanGrade({ value: 4.0, scale: 4 })).toBe(1.0);
    expect(germanGrade({ value: 3.0, scale: 4 })).toBe(2.5); // 1 + 3 × 1 / 2
    expect(germanGrade({ value: 3.5, scale: 4 })).toBe(1.7); // 1.75 → 1.7
    expect(germanGrade({ value: 2.0, scale: 4 })).toBe(4.0);
    expect(germanGrade({ value: 1.9, scale: 4 })).toBeNull(); // below pass
    expect(germanGrade({ value: 4.0, scale: 5 })).toBe(1.7); // HSC 4.0/5, pass 1.0
  });

  it("maps to the Italian 110 and Hungarian 5-point scales", () => {
    expect(italianGrade110({ value: 4.0, scale: 4 })).toBe(110);
    expect(italianGrade110({ value: 3.0, scale: 4 })).toBe(88);
    expect(italianGrade110({ value: 2.0, scale: 4 })).toBe(66);
    expect(hungarianGrade5({ value: 3.0, scale: 4 })).toBe(3.5);
    expect(hungarianGrade5({ value: 5.0, scale: 5 })).toBe(5);
  });

  it("converts SSC/HSC GPA (out of 5) and CGPA (out of 4) both ways", () => {
    expect(convertGrade({ value: 4.5, scale: 5 })).toEqual({
      fourPoint: 3.6,
      fivePoint: 4.5,
      percent: 90,
      german: 1.3,
      italian110: 105, // 66 + 44 × 0.875 = 104.5
      hungarian5: 4.63,
    });
    expect(convertGrade({ value: 3.6, scale: 4 }).fivePoint).toBe(4.5);
    expect(rescale(3, 4, 10)).toBe(7.5);
  });

  it("respects a custom passing grade", () => {
    expect(germanGrade({ value: 2.5, scale: 4, minPass: 2.5 })).toBe(4.0);
  });
});
