// Turns a web page into plain text the extractor can read, plus the list of links on it.
// No HTML library: university pages only need scripts, styles, menus and cookie banners dropped,
// block elements turned into line breaks, tables into "cell | cell" rows, and entities decoded.

import { createHash } from "node:crypto";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", euro: "€", pound: "£", hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", middot: "·", deg: "°" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Elements whose whole content is noise for us. */
const DROP = ["script", "style", "noscript", "svg", "template", "iframe", "canvas", "nav", "footer", "form", "select", "button"];
/** Common class/id names of menus, cookie banners and the like. */
const NOISE_ATTR = /\b(cookie|consent|gdpr|navbar|nav-|menu|breadcrumb|skip-link|social|share|newsletter|footer|header-top|megamenu|offcanvas|modal)\b/i;

export function htmlToText(html: string): string {
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  for (const tag of DROP) s = s.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi"), " ");
  // Drop <div>/<section>/<aside>/<header> blocks marked as menus or banners (one level deep is enough in practice).
  s = s.replace(/<(div|section|aside|header|ul)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (whole, _tag: string, attrs: string) => (NOISE_ATTR.test(attrs) ? " " : whole));
  // Keep the main content when the page marks it.
  const main = s.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? s.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  if (main && main.length > 500) s = main;
  s = s.replace(/<(td|th)\b[^>]*>/gi, " | ");
  s = s.replace(/<\/(tr)>/gi, "\n");
  s = s.replace(/<li\b[^>]*>/gi, "\n• ");
  s = s.replace(/<(h[1-6])\b[^>]*>/gi, "\n\n## ");
  s = s.replace(/<\/?(p|div|section|article|header|aside|ul|ol|table|tbody|thead|h[1-6]|dl|dt|dd|blockquote|figure|figcaption|address)\b[^>]*>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  return s
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").replace(/^\s*\|\s*/, "").trim())
    .filter((line, i, all) => line !== "" || (all[i - 1] ?? "") !== "")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function pageTitle(html: string): string {
  return decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
}

export interface PageLink {
  url: string;
  text: string;
}

/** Links on the page, made absolute, without fragments, same-site only by default. */
export function extractLinks(html: string, baseUrl: string, { sameSite = true } = {}): PageLink[] {
  const base = new URL(baseUrl);
  const seen = new Map<string, PageLink>();
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "").trim();
    if (!href || /^(mailto|tel|javascript|data):/i.test(href)) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    if (sameSite && registrable(url.hostname) !== registrable(base.hostname)) continue;
    url.hash = "";
    const key = url.toString();
    const text = decodeEntities(m[5]!.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (!seen.has(key) || (text && !seen.get(key)!.text)) seen.set(key, { url: key, text });
  }
  return [...seen.values()];
}

/** "www.uni-example.de" and "admissions.uni-example.de" count as the same site. */
export function registrable(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  // Second-level country domains like ac.uk, edu.au, co.jp keep three labels.
  const keep = parts.length > 2 && /^(ac|co|edu|gov|org|com|net)$/.test(parts.at(-2)!) && parts.at(-1)!.length === 2 ? 3 : 2;
  return parts.slice(-keep).join(".");
}

/** Hash of the text with things that change on every visit (times, counters) taken out. */
export function contentHash(text: string): string {
  const stable = text.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, "").replace(/\s+/g, " ");
  return createHash("sha256").update(stable).digest("hex");
}

/** URLs listed in a sitemap.xml (or sitemap index). */
export function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decodeEntities(m[1]!));
}

export interface PageMeta {
  title: string;
  h1: string;
  description: string;
  lang: string;
  /** schema.org objects embedded for search engines (Course, EducationalOccupationalProgram …). */
  jsonLd: Record<string, unknown>[];
  /** The English version of this page, when the page lists one (<link rel="alternate" hreflang="en">). */
  english: string | null;
}

function englishAlternate(html: string): string | null {
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel=["']alternate["']/i.test(tag) || !/hreflang=["']en(-[a-z]+)?["']/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (href && /^https?:\/\//.test(href)) return decodeEntities(href);
  }
  return null;
}

const metaContent = (html: string, name: string) =>
  decodeEntities(
    html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i"))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i"))?.[1] ??
      "",
  ).trim();

export function pageMeta(html: string): PageMeta {
  const jsonLd: Record<string, unknown>[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1]!.trim()) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && typeof item === "object") {
          const graph = (item as { "@graph"?: unknown[] })["@graph"];
          for (const g of Array.isArray(graph) ? graph : [item]) if (g && typeof g === "object") jsonLd.push(g as Record<string, unknown>);
        }
      }
    } catch {
      // Broken JSON-LD is common; skip it.
    }
  }
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "";
  return {
    title: pageTitle(html),
    h1: decodeEntities(h1.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(),
    description: metaContent(html, "description") || metaContent(html, "og:description"),
    lang: (html.match(/<html[^>]*\blang=["']([a-zA-Z-]+)["']/i)?.[1] ?? "").toLowerCase().slice(0, 2),
    jsonLd,
    english: englishAlternate(html),
  };
}
