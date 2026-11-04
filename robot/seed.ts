// Adds a country's universities from Wikidata (free, public-domain data): name, official website,
// public/private and city, biggest first. Then `discover` finds each one's program pages.
// New countries and cities are saved unpublished: their guides (costs, visa, jobs) still need writing.

import { USER_AGENT } from "./fetch.ts";
import { db } from "./db.ts";

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

interface Row {
  uni: string;
  name: string;
  website: string;
  city?: string;
  cityEn?: string;
  cityBn?: string;
  students?: number;
  private: boolean;
}

async function sparql(q: string): Promise<Record<string, { value: string }>[]> {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json" } });
    if (res.ok) return ((await res.json()) as { results: { bindings: Record<string, { value: string }>[] } }).results.bindings;
    if (attempt >= 3 || (res.status !== 429 && res.status < 500)) throw new Error(`Wikidata answered ${res.status}`);
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
}

/** Raw Wikidata rows for a country's universities, best known first (two light queries; one big one times out). */
export async function wikidataUniversities(iso: string, limit: number): Promise<Record<string, { value: string }>[]> {
  const [country] = await sparql(`SELECT ?country ?countryEn ?countryBn ?currency WHERE {
    ?country wdt:P297 "${iso}".
    ?country rdfs:label ?countryEn FILTER(lang(?countryEn) = "en")
    OPTIONAL { ?country rdfs:label ?countryBn FILTER(lang(?countryBn) = "bn") }
    OPTIONAL { ?country wdt:P38/wdt:P498 ?currency }
  } LIMIT 1`);
  if (!country) return [];
  const qid = country.country!.value.split("/").pop();
  const top = await sparql(`SELECT DISTINCT ?uni ?links WHERE {
    VALUES ?kind { wd:Q3918 wd:Q875538 wd:Q902104 wd:Q1371037 wd:Q15936437 }
    ?uni wdt:P31 ?kind; wdt:P17 wd:${qid}; wikibase:sitelinks ?links.
  } ORDER BY DESC(?links) LIMIT ${limit * 2}`);
  if (!top.length) return [];
  const links = new Map(top.map((r) => [r.uni!.value, r.links!]));
  const ids = top.map((r) => `wd:${r.uni!.value.split("/").pop()}`).join(" ");
  const rows = (
    await sparql(`SELECT ?uni ?name ?website ?cityEn ?cityBn ?private WHERE {
    VALUES ?uni { ${ids} }
    ?uni wdt:P856 ?website.
    FILTER NOT EXISTS { ?uni wdt:P576 [] }
    ?uni rdfs:label ?name FILTER(lang(?name) = "en")
    BIND(IF(EXISTS { ?uni wdt:P31 wd:Q902104 }, "1", "0") AS ?private)
    # The city must be in this country: schools with campuses abroad (e.g. ESCP) list foreign cities too.
    OPTIONAL { ?uni wdt:P131 ?city. ?city wdt:P17 wd:${qid}. ?city rdfs:label ?cityEn FILTER(lang(?cityEn) = "en") OPTIONAL { ?city rdfs:label ?cityBn FILTER(lang(?cityBn) = "bn") } }
  }`)
  ).map((r) => ({ ...r, links: links.get(r.uni!.value)! }));
  // Most Wikipedia languages first: a decent stand-in for how well known a university is.
  const order = (r: Record<string, { value: string }>) => -Number(r.links?.value ?? 0);
  return rows.sort((a, b) => order(a) - order(b)).map((r) => ({ ...r, ...country }));
}

export async function seedCountry(isoCode: string, limit: number) {
  const iso = isoCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso)) throw new Error("Usage: npm run robot -- seed <two-letter country code, e.g. DE> [--limit 30]");
  const b = await wikidataUniversities(iso, limit);
  if (!b.length) throw new Error(`Wikidata has no universities for ${iso}`);

  const first = b[0]!;
  const countryEn = first.countryEn!.value;
  const countrySlug = slugify(countryEn);
  const currency = b.find((x) => x.currency)?.currency?.value ?? "EUR";
  const { data: existingCountry } = await db().from("countries").select("slug").eq("slug", countrySlug).maybeSingle();
  if (!existingCountry) {
    await db().from("countries").insert({ slug: countrySlug, name_en: countryEn, name_bn: first.countryBn?.value ?? countryEn, currency, origin: "robot", published: false, source_url: "https://www.wikidata.org" });
    console.log(`Added country ${countryEn} (unpublished until its guide is written)`);
  }

  // One row per university (Wikidata can list several cities or websites).
  const byUni = new Map<string, Row>();
  for (const x of b) {
    const id = x.uni!.value;
    if (byUni.has(id)) continue;
    byUni.set(id, {
      uni: id,
      name: x.name!.value,
      website: x.website!.value,
      cityEn: x.cityEn?.value,
      cityBn: x.cityBn?.value,
      students: undefined,
      private: x.private?.value === "1",
    });
  }
  let added = 0;
  for (const u of [...byUni.values()].slice(0, limit)) {
    if (!u.cityEn) continue;
    const citySlug = slugify(u.cityEn);
    await db()
      .from("cities")
      .upsert({ slug: citySlug, country: countrySlug, name_en: u.cityEn, name_bn: u.cityBn ?? u.cityEn, origin: "robot", published: false, source_url: "https://www.wikidata.org" }, { onConflict: "slug", ignoreDuplicates: true });
    const { error } = await db()
      .from("universities")
      .upsert(
        { slug: slugify(u.name), city: citySlug, name: u.name, type: u.private ? "private" : "public", website: u.website, origin: "robot", published: false, source_url: u.uni },
        { onConflict: "slug", ignoreDuplicates: true },
      );
    if (error) console.log(`  skipped ${u.name}: ${error.message}`);
    else {
      added++;
      console.log(`  ${u.name} (${u.cityEn})${u.students ? `, ${u.students.toLocaleString("en")} students` : ""}`);
    }
  }
  console.log(`${added} universities ready. Next: npm run robot -- discover <university-slug>, or discover-all.`);
}
