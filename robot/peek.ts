// Fetch one page politely and print its cleaned text: npm run robot:peek -- <url>
import { contentHash, extractLinks, htmlToText, pageTitle } from "./clean.ts";
import { politeFetch } from "./fetch.ts";

const url = process.argv[2];
if (!url) throw new Error("Usage: npm run robot:peek -- <url>");
const page = await politeFetch(url);
console.log(`${page.status} ${page.kind} ${page.finalUrl}`);
if (page.kind === "html") {
  const text = htmlToText(page.body);
  console.log(`title: ${pageTitle(page.body)}\nhash: ${contentHash(text).slice(0, 12)}  text: ${text.length} chars  links: ${extractLinks(page.body, page.finalUrl).length}\n`);
  console.log(text.slice(0, Number(process.argv[3] ?? 3000)));
}
