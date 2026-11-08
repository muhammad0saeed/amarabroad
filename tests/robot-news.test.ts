import { describe, expect, it } from "vitest";
import { classify, countriesIn, isForStudents, NEWS_DAYS, parseFeed } from "../robot/news.ts";

const TODAY = "2026-11-09";

describe("reading feeds", () => {
  it("reads RSS items", () => {
    const xml = `<rss><channel><title>Feed</title><item><title><![CDATA[Canada extends student arrivals target]]></title><link>https://example.org/a?x=1&amp;y=2</link><pubDate>Fri, 06 Nov 2026 10:00:00 +0000</pubDate><description>&lt;p&gt;International students &amp;#8211; more&lt;/p&gt;</description></item></channel></rss>`;
    expect(parseFeed(xml)).toEqual([{ title: "Canada extends student arrivals target", url: "https://example.org/a?x=1&y=2", published: "2026-11-06", summary: "International students – more" }]);
  });

  it("reads Atom entries", () => {
    const xml = `<feed><title>GOV.UK</title><entry><title>Student visa fee changes</title><link rel="alternate" type="text/html" href="https://www.gov.uk/news/x"/><updated>2026-11-05T09:00:00+00:00</updated><summary>New fees from April.</summary></entry></feed>`;
    expect(parseFeed(xml)[0]).toMatchObject({ title: "Student visa fee changes", url: "https://www.gov.uk/news/x", published: "2026-11-05" });
  });
});

describe("what's kept", () => {
  it("keeps student news and drops recruitment-business and asylum stories", () => {
    expect(isForStudents({ title: "Canada extends 150,000 international student arrivals target to 2029", summary: "" })).toBe(true);
    expect(isForStudents({ title: "Graduate Route cut to 18 months", summary: "" })).toBe(true);
    expect(isForStudents({ title: "Global agent survey on international student markets", summary: "" })).toBe(false);
    expect(isForStudents({ title: "Asylum appeals target launched", summary: "for international students" })).toBe(false);
    expect(isForStudents({ title: "Law Officers mark 25 years of Pro Bono Week", summary: "" })).toBe(false);
    expect(isForStudents({ title: "API and The Intern Group join forces to connect study abroad and internships", summary: "" })).toBe(false);
  });

  it("tags countries, carefully with US and UK", () => {
    expect(countriesIn("Germany and the Netherlands tighten rules for Dutch universities")).toEqual(["germany", "netherlands"]);
    expect(countriesIn("Tell us what you think about study in Latin America")).toEqual([]);
    expect(countriesIn("US visa interviews resume; UK Graduate Route")).toEqual(["united-kingdom", "united-states"]);
  });
});

describe("removal rules", () => {
  it("a stated deadline: removed the day after", () => {
    expect(classify({ title: "Scholarship applications close on 15 January 2027", summary: "" }, "2026-11-01", TODAY)).toEqual({ kind: "deadline", deadline: "2027-01-15", expires_on: "2027-01-16" });
    expect(classify({ title: "Apply by 20 December", summary: "" }, "2026-11-01", TODAY)).toMatchObject({ kind: "deadline", deadline: "2026-12-20" });
  });

  it("guides and 'no deadline' items are kept; other news goes after 4 months", () => {
    expect(classify({ title: "A guide to the Graduate Route", summary: "" }, "2026-11-01", TODAY)).toEqual({ kind: "evergreen", deadline: null, expires_on: null });
    expect(classify({ title: "Why pursue a bachelor's degree in the Netherlands?", summary: "" }, "2026-08-05", TODAY).kind).toBe("evergreen");
    expect(classify({ title: "New visa you can apply anytime", summary: "" }, "2026-11-01", TODAY).kind).toBe("open");
    const news = classify({ title: "Visa fees rise before 2027", summary: "" }, "2026-11-01", TODAY);
    expect(news.kind).toBe("news");
    expect(news.expires_on).toBe(new Date(Date.parse("2026-11-01") + NEWS_DAYS * 86_400_000).toISOString().slice(0, 10));
  });
});
