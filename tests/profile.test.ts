import { describe, expect, it } from "vitest";
import { emptyProfile, isProfileComplete, parseProfile, parseProfileFile, profileFileContents } from "@/lib/profile";
import { item, profile } from "./helpers";

describe("profile export and import", () => {
  it("round-trips through an exported file", () => {
    const p = profile({ certificates: [item("computing")], extracurriculars: [item("general", "leadership", ["leadership"])], target_countries: ["italy"] });
    const file = profileFileContents(p, "amarAbroad");
    expect(JSON.parse(file)).toMatchObject({ app: "amarAbroad", version: 1 });
    expect(parseProfileFile(file)).toEqual(p);
  });

  it("also accepts a bare profile object", () => {
    expect(parseProfileFile(JSON.stringify(profile()))).toEqual(profile());
  });

  it("rejects files that aren't profiles", () => {
    expect(parseProfileFile("not json")).toBeNull();
    expect(parseProfileFile("[1,2,3]")).toEqual(expect.objectContaining({ degree_type: "" }));
    expect(isProfileComplete(parseProfileFile("[1,2,3]"))).toBe(false);
    expect(isProfileComplete(parseProfileFile("null"))).toBe(false);
  });

  it("drops out-of-range or malformed values instead of trusting them", () => {
    const cleaned = parseProfile({
      ...profile(),
      cgpa: 9,
      english_test: "ielts",
      english_score: 12,
      experience_months: -4,
      university_type: "hacker",
      certificates: [{ label: "<script>", kind: "evil", group: "nowhere", traits: ["leadership", "x"] }],
      skills: Array(50).fill("a"),
    });
    expect(cleaned).toMatchObject({ cgpa: null, english_score: null, experience_months: 0, university_type: "public" });
    expect(cleaned?.certificates).toEqual([{ label: "<script>", kind: "extracurricular", group: "general", traits: ["leadership"] }]);
    expect(cleaned?.skills).toHaveLength(20);
  });

  it("starts empty and incomplete", () => {
    expect(isProfileComplete(emptyProfile())).toBe(false);
    expect(isProfileComplete(profile())).toBe(true);
  });
});
