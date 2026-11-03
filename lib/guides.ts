// Guides are Markdown files in content/guides/<locale>/<slug>.md, turned into HTML at build time.
// A Bangla guide that doesn't exist yet falls back to the English one.
// Server-only: reads the file system during the static build.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import type { AppLocale } from "./localize";

const ROOT = join(process.cwd(), "content", "guides");

export interface Guide {
  slug: string;
  title: string;
  summary: string;
  order: number;
  html: string;
  /** True when a Bangla reader gets the English text. */
  isFallback: boolean;
}

/** Minimal front matter: `key: value` lines between --- fences. */
function parse(text: string): { meta: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { meta: {}, body: text };
  const meta = Object.fromEntries(
    match[1]!.split(/\r?\n/).flatMap((line) => {
      const i = line.indexOf(":");
      return i > 0 ? [[line.slice(0, i).trim(), line.slice(i + 1).trim()]] : [];
    }),
  );
  return { meta, body: text.slice(match[0].length) };
}

function load(slug: string, locale: AppLocale): Guide {
  const localized = join(ROOT, locale, `${slug}.md`);
  const isFallback = !existsSync(localized);
  const { meta, body } = parse(readFileSync(isFallback ? join(ROOT, "en", `${slug}.md`) : localized, "utf8"));
  return {
    slug,
    title: meta.title ?? slug,
    summary: meta.summary ?? "",
    order: Number(meta.order ?? 99),
    html: marked.parse(body, { async: false, gfm: true }),
    isFallback: locale !== "en" && isFallback,
  };
}

export function guideSlugs(): string[] {
  return readdirSync(join(ROOT, "en"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

export function listGuides(locale: AppLocale): Guide[] {
  return guideSlugs()
    .map((slug) => load(slug, locale))
    .sort((a, b) => a.order - b.order);
}

export function getGuide(slug: string, locale: AppLocale): Guide | undefined {
  return guideSlugs().includes(slug) ? load(slug, locale) : undefined;
}
