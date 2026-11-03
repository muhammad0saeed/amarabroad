import { describe, expect, it } from "vitest";
import bn from "@/messages/bn.json";
import en from "@/messages/en.json";

type Messages = { [key: string]: string | Messages };

function flatten(messages: Messages, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const flatEn = flatten(en);
const flatBn = flatten(bn);
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

describe("UI strings", () => {
  it("has the same keys in English and Bangla", () => {
    expect(Object.keys(flatBn).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it("has no empty strings", () => {
    for (const [key, value] of Object.entries({ ...flatEn, ...flatBn })) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("uses the same {placeholders} in both languages", () => {
    for (const key of Object.keys(flatEn)) {
      expect(placeholders(flatBn[key] ?? ""), key).toEqual(placeholders(flatEn[key]!));
    }
  });
});
