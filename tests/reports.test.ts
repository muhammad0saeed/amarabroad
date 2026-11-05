import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { formatMessage, notify } = await import("@/lib/reports/telegram");

describe("Telegram messages", () => {
  it("escapes what visitors typed, drops empty lines and adds the link", () => {
    const text = formatMessage({
      title: "Wrong info",
      lines: [
        ["Program", "x"],
        ["Correction", "<script>alert(1)</script> & more"],
        ["Reply to", null],
      ],
      link: { label: "Open", url: "https://site.example/en/programs/x/" },
    });
    expect(text).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; more");
    expect(text).not.toContain("<script>");
    expect(text).not.toContain("Reply to");
    expect(text).toContain('<a href="https://site.example/en/programs/x/">Open</a>');
  });

  it("does nothing (and doesn't fail) when Telegram isn't set up", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect(await notify({ title: "t", lines: [] })).toBe(false);
  });
});
