import { describe, expect, it } from "vitest";
import { formatBDT, formatIndianInteger, formatMoney, formatWestern, rateTable, toBDT } from "@/lib/money";
import exchangeRates from "@/data/exchange-rates.json";
import type { ExchangeRate } from "@/types";

describe("taka formatting", () => {
  it("groups digits the South Asian way", () => {
    expect(formatIndianInteger(999)).toBe("999");
    expect(formatIndianInteger(1000)).toBe("1,000");
    expect(formatIndianInteger(100000)).toBe("1,00,000");
    expect(formatIndianInteger(1234567)).toBe("12,34,567");
    expect(formatIndianInteger(123456789)).toBe("12,34,56,789");
  });

  it("shows lakh and crore", () => {
    expect(formatBDT(85000)).toBe("৳ 85,000");
    expect(formatBDT(100000)).toBe("৳ 1 lakh");
    expect(formatBDT(1250000)).toBe("৳ 12.5 lakh");
    expect(formatBDT(1200000)).toBe("৳ 12 lakh");
    expect(formatBDT(3936520)).toBe("৳ 39.4 lakh");
    expect(formatBDT(12500000)).toBe("৳ 1.25 crore");
    expect(formatBDT(9996000)).toBe("৳ 1 crore"); // 99.96 lakh rounds to 100 lakh
  });

  it("writes Bangla digits and units in Bangla", () => {
    expect(formatBDT(1250000, "bn")).toBe("৳ ১২.৫ লাখ");
    expect(formatBDT(12500000, "bn")).toBe("৳ ১.২৫ কোটি");
    expect(formatBDT(85000, "bn")).toBe("৳ ৮৫,০০০");
  });

  it("can show the full number", () => {
    expect(formatBDT(1250000, "en", { compact: false })).toBe("৳ 12,50,000");
  });
});

describe("local currency", () => {
  it("formats euros and forints", () => {
    expect(formatMoney(2800, "EUR")).toBe("€2,800");
    expect(formatMoney(13.5, "EUR")).toBe("€13.5");
    expect(formatMoney(160000, "HUF")).toBe("160,000 Ft");
    expect(formatMoney(2800, "EUR", "bn")).toBe("€২,৮০০");
    expect(formatWestern(1234567.891)).toBe("1,234,567.89");
  });

  it("converts to taka with the sample rates", () => {
    const rates = rateTable(exchangeRates as ExchangeRate[]);
    expect(rates).toEqual({ EUR: 140, HUF: 0.35 });
    expect(toBDT(1000, "EUR", rates)).toBe(140000);
    expect(toBDT(100000, "HUF", rates)).toBeCloseTo(35000);
  });
});
