// Adds the top universities across our countries, ranked, with their city and website.
//
// Source: OpenAlex (free, public-domain research database, https://openalex.org). Rank = research
// h-index among the education institutions of our countries. It is an open stand-in for QS/THE,
// whose rankings can't be copied. Public/private comes from Wikidata. No AI involved.
//
// Every country gets at least `--floor` universities (or all it has), the rest go by rank, until `--total`.
// Then `discover-all` finds each one's program pages, best ranked first.
//
//   npm run robot -- seed-top [--total 5000] [--floor 50] [--fresh] [--dry]
//   --fresh  first remove robot-made universities that have no program pages yet (and their empty cities)
//   --dry    print the plan, save nothing

import { USER_AGENT } from "./fetch.ts";
import { db } from "./db.ts";
import { slugify } from "./seed.ts";

/** Our countries. Slugs match the rows already in the database. */
export const COUNTRIES: { iso: string; slug: string; name: string; currency: string; eu: boolean }[] = [
  { iso: "DE", slug: "germany", name: "Germany", currency: "EUR", eu: true },
  { iso: "IT", slug: "italy", name: "Italy", currency: "EUR", eu: true },
  { iso: "HU", slug: "hungary", name: "Hungary", currency: "HUF", eu: true },
  { iso: "NL", slug: "netherlands", name: "Netherlands", currency: "EUR", eu: true },
  { iso: "FI", slug: "finland", name: "Finland", currency: "EUR", eu: true },
  { iso: "SE", slug: "sweden", name: "Sweden", currency: "SEK", eu: true },
  { iso: "DK", slug: "denmark", name: "Denmark", currency: "DKK", eu: true },
  { iso: "NO", slug: "norway", name: "Norway", currency: "NOK", eu: false },
  { iso: "FR", slug: "france", name: "France", currency: "EUR", eu: true },
  { iso: "BE", slug: "belgium", name: "Belgium", currency: "EUR", eu: true },
  { iso: "AT", slug: "austria", name: "Austria", currency: "EUR", eu: true },
  { iso: "PL", slug: "poland", name: "Poland", currency: "PLN", eu: true },
  { iso: "CZ", slug: "czech-republic", name: "Czech Republic", currency: "CZK", eu: true },
  { iso: "LT", slug: "lithuania", name: "Lithuania", currency: "EUR", eu: true },
  { iso: "LV", slug: "latvia", name: "Latvia", currency: "EUR", eu: true },
  { iso: "EE", slug: "estonia", name: "Estonia", currency: "EUR", eu: true },
  { iso: "ES", slug: "spain", name: "Spain", currency: "EUR", eu: true },
  { iso: "PT", slug: "portugal", name: "Portugal", currency: "EUR", eu: true },
  { iso: "IE", slug: "ireland", name: "Ireland", currency: "EUR", eu: true },
  { iso: "CY", slug: "cyprus", name: "Cyprus", currency: "EUR", eu: true },
  { iso: "MT", slug: "malta", name: "Malta", currency: "EUR", eu: true },
  { iso: "GB", slug: "united-kingdom", name: "United Kingdom", currency: "GBP", eu: false },
  { iso: "CA", slug: "canada", name: "Canada", currency: "CAD", eu: false },
  { iso: "US", slug: "united-states", name: "United States", currency: "USD", eu: false },
  { iso: "AU", slug: "australia", name: "Australia", currency: "AUD", eu: false },
  { iso: "MY", slug: "malaysia", name: "Malaysia", currency: "MYR", eu: false },
  { iso: "JP", slug: "japan", name: "Japan", currency: "JPY", eu: false },
  { iso: "KR", slug: "south-korea", name: "South Korea", currency: "KRW", eu: false },
  { iso: "TR", slug: "turkey", name: "Turkey", currency: "TRY", eu: false },
  { iso: "CN", slug: "china", name: "China", currency: "CNY", eu: false },
];
/** Old slugs the first (Wikidata) seeding made, renamed to the ones above. */
const RENAMED: Record<string, string> = { "kingdom-of-the-netherlands": "netherlands", "people-s-republic-of-china": "china" };

interface Institution {
  id: string;
  display_name: string;
  homepage_url: string | null;
  geo: { city: string | null; country_code: string };
  summary_stats: { h_index: number };
  cited_by_count: number;
  ids: { wikidata?: string; ror?: string };
}

export interface Pick {
  inst: Institution;
  iso: string;
  rank: number;
  countryRank: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if (res.ok) return (await res.json()) as T;
    if (attempt >= 4 || (res.status !== 429 && res.status < 500)) throw new Error(`${new URL(url).host} answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    await sleep(4000 * attempt);
  }
}

/** A country's education institutions with a website and a city, highest h-index first. */
async function countryList(iso: string, max: number): Promise<Institution[]> {
  const out: Institution[] = [];
  for (let page = 1; out.length < max; page++) {
    const url = `https://api.openalex.org/institutions?filter=country_code:${iso},type:education&sort=summary_stats.h_index:desc&per_page=200&page=${page}&select=id,display_name,homepage_url,geo,summary_stats,cited_by_count,ids`;
    const r = await getJson<{ results: Institution[] }>(url);
    out.push(...r.results.filter((x) => x.homepage_url && x.geo.city));
    if (r.results.length < 200) break;
  }
  return out.slice(0, max);
}

/** Pure: each country's top `floor` (or all), then the best of the rest by h-index, until `total`. */
export function choose(lists: Map<string, Institution[]>, total: number, floor: number): Pick[] {
  const chosen = new Set<string>();
  const iso = new Map<string, string>();
  for (const [c, list] of lists) for (const x of list) iso.set(x.id, c);
  for (const list of lists.values()) for (const x of list.slice(0, floor)) chosen.add(x.id);
  const rest = [...lists.values()].flat().filter((x) => !chosen.has(x.id));
  rest.sort((a, b) => b.summary_stats.h_index - a.summary_stats.h_index || b.cited_by_count - a.cited_by_count);
  for (const x of rest) {
    if (chosen.size >= total) break;
    chosen.add(x.id);
  }
  const all = [...lists.values()].flat().filter((x) => chosen.has(x.id));
  all.sort((a, b) => b.summary_stats.h_index - a.summary_stats.h_index || b.cited_by_count - a.cited_by_count);
  const perCountry = new Map<string, number>();
  return all.map((inst, i) => {
    const c = iso.get(inst.id)!;
    perCountry.set(c, (perCountry.get(c) ?? 0) + 1);
    return { inst, iso: c, rank: i + 1, countryRank: perCountry.get(c)! };
  });
}

async function sparql(q: string): Promise<Record<string, { value: string }>[]> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://query.wikidata.org/sparql", {
      method: "POST",
      headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
      body: `query=${encodeURIComponent(q)}`,
    });
    if (res.ok) return ((await res.json()) as { results: { bindings: Record<string, { value: string }>[] } }).results.bindings;
    if (attempt >= 4) throw new Error(`Wikidata answered ${res.status}`);
    await sleep(5000 * attempt);
  }
}

const PRIVATE_KINDS = "wd:Q902104 wd:Q23002054 wd:Q23002037"; // private university; private not-for-profit / for-profit institution

/**
 * Wikidata ids of private universities (unknown counts as public). OpenAlex links only some
 * institutions to Wikidata; the others are found by their ROR id, and that link is filled in.
 */
async function privateOnes(picks: Pick[]): Promise<Set<string>> {
  const missing = picks.filter((p) => !qidOf(p.inst.ids.wikidata) && p.inst.ids.ror);
  for (let i = 0; i < missing.length; i += 250) {
    const chunk = missing.slice(i, i + 250);
    const rors = chunk.map((p) => `"${p.inst.ids.ror!.split("/").pop()}"`).join(" ");
    const rows = await sparql(`SELECT ?ror ?u WHERE { VALUES ?ror { ${rors} } ?u wdt:P6782 ?ror }`);
    const byRor = new Map(rows.map((r) => [r.ror!.value, r.u!.value]));
    for (const p of chunk) {
      const qid = byRor.get(p.inst.ids.ror!.split("/").pop()!);
      if (qid) p.inst.ids.wikidata = qid;
    }
  }
  const qids = picks.map((p) => qidOf(p.inst.ids.wikidata)).filter((q): q is string => !!q);
  const out = new Set<string>();
  for (let i = 0; i < qids.length; i += 250) {
    const ids = qids.slice(i, i + 250).map((q) => `wd:${q}`).join(" ");
    for (const r of await sparql(`SELECT DISTINCT ?u WHERE { VALUES ?u { ${ids} } VALUES ?kind { ${PRIVATE_KINDS} } ?u wdt:P31 ?kind }`)) out.add(r.u!.value.split("/").pop()!);
  }
  return out;
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};
const qidOf = (url: string | undefined) => url?.match(/Q\d+$/)?.[0];

async function all<T>(table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data as T[]));
    if (data.length < 1000) return out;
  }
}

async function inChunks<T>(rows: T[], size: number, write: (chunk: T[]) => PromiseLike<{ error: { message: string } | null }>, what: string) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await write(rows.slice(i, i + size));
    if (error) throw new Error(`${what}: ${error.message}`);
  }
}

export async function seedTop(opts: { total: number; floor: number; fresh: boolean; dry: boolean }) {
  const log = (...p: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...p);

  // 1. Ranked lists from OpenAlex (about 50 requests; no key needed).
  const lists = new Map<string, Institution[]>();
  for (const c of COUNTRIES) {
    lists.set(c.iso, await countryList(c.iso, Math.max(opts.floor, 2600)));
    log(`${c.iso}: ${lists.get(c.iso)!.length} with website and city`);
  }
  const picks = choose(lists, opts.total, opts.floor);
  const counts = Object.fromEntries(COUNTRIES.map((c) => [c.iso, picks.filter((p) => p.iso === c.iso).length]));
  log(`Chose ${picks.length}:`, JSON.stringify(counts));
  log(`Rank #${picks.length} has h-index ${picks.at(-1)?.inst.summary_stats.h_index}`);

  const priv = await privateOnes(picks);
  const linked = picks.filter((p) => qidOf(p.inst.ids.wikidata)).length;
  log(`${priv.size} are private (Wikidata), the rest public; ${picks.length - linked} have no Wikidata link`);
  if (opts.dry) {
    for (const p of picks.slice(0, 15)) log(`#${p.rank} ${p.inst.display_name} (${p.inst.geo.city}, ${p.iso}) ${p.inst.homepage_url}`);
    return;
  }

  // 2. Countries: add missing ones, fix the first seeding's names (robot-made rows only).
  for (const [from, to] of Object.entries(RENAMED)) {
    const { data } = await db().from("countries").select("slug").eq("slug", to).maybeSingle();
    if (!data) await db().from("countries").update({ slug: to }).eq("slug", from).eq("origin", "robot");
  }
  const countries = await all<{ slug: string; origin: string }>("countries", "slug, origin");
  for (const c of COUNTRIES) {
    const row = countries.find((x) => x.slug === c.slug);
    if (!row) {
      const { error } = await db().from("countries").insert({ slug: c.slug, name_en: c.name, name_bn: c.name, currency: c.currency, eu_member: c.eu, origin: "robot", published: false, source_url: "https://openalex.org" });
      if (error) throw new Error(`country ${c.name}: ${error.message}`);
      log(`Added country ${c.name}`);
    } else if (row.origin === "robot") {
      await db().from("countries").update({ name_en: c.name, currency: c.currency, eu_member: c.eu }).eq("slug", c.slug);
    }
  }

  // 3. Fresh start: robot universities nobody has searched yet are re-made from the ranked list.
  if (opts.fresh) {
    const sources = await all<{ university: string | null }>("sources", "university");
    const programs = await all<{ university: string }>("programs", "university");
    const used = new Set([...sources.map((s) => s.university), ...programs.map((p) => p.university)]);
    const old = await all<{ slug: string; origin: string; published: boolean }>("universities", "slug, origin, published");
    const drop = old.filter((u) => u.origin === "robot" && !u.published && !used.has(u.slug)).map((u) => u.slug);
    await inChunks(drop, 200, (chunk) => db().from("universities").delete().in("slug", chunk), "remove old universities");
    log(`Removed ${drop.length} unsearched robot universities (they come back from the ranked list)`);
  }

  // 4. Cities and universities.
  const cities = await all<{ slug: string; country: string }>("cities", "slug, country");
  const unis = await all<{ slug: string; website: string; source_url: string; origin: string }>("universities", "slug, website, source_url, origin");
  const cityCountry = new Map(cities.map((c) => [c.slug, c.country]));
  const bySlug = new Map(unis.map((u) => [u.slug, u]));
  const byQid = new Map(unis.map((u) => [qidOf(u.source_url), u]).filter(([q]) => q) as [string, (typeof unis)[number]][]);
  const byHost = new Map(unis.map((u) => [host(u.website), u]));
  const slugOfCountry = new Map(COUNTRIES.map((c) => [c.iso, c.slug]));

  const newCities: Record<string, unknown>[] = [];
  const cityFor = (name: string, iso: string): string => {
    const country = slugOfCountry.get(iso)!;
    for (const slug of [slugify(name), `${slugify(name)}-${iso.toLowerCase()}`]) {
      const owner = cityCountry.get(slug);
      if (owner === country) return slug;
      if (owner === undefined) {
        cityCountry.set(slug, country);
        newCities.push({ slug, country, name_en: name, name_bn: name, origin: "robot", published: false, source_url: "https://openalex.org" });
        return slug;
      }
    }
    throw new Error(`No free slug for city ${name} (${iso})`);
  };

  const inserts: Record<string, unknown>[] = [];
  const updates: { slug: string; patch: Record<string, unknown> }[] = [];
  const taken = new Set(bySlug.keys());
  for (const p of picks) {
    const i = p.inst;
    const city = cityFor(i.geo.city!, p.iso);
    const qid = qidOf(i.ids.wikidata);
    const ranking = { rank: p.rank, country_rank: p.countryRank, h_index: i.summary_stats.h_index, source: "OpenAlex research rank", year: new Date().getFullYear(), url: i.id };
    const existing = (qid && byQid.get(qid)) || byHost.get(host(i.homepage_url!));
    if (existing) {
      // Robot rows get the corrected city too; rows you made or edited only get the rank.
      updates.push({ slug: existing.slug, patch: existing.origin === "robot" ? { ranking, city } : { ranking } });
      continue;
    }
    let slug = slugify(i.display_name);
    if (taken.has(slug)) slug = slugify(`${i.display_name} ${i.geo.city}`);
    for (let n = 2; taken.has(slug); n++) slug = `${slugify(`${i.display_name} ${i.geo.city}`)}-${n}`;
    taken.add(slug);
    inserts.push({ slug, city, name: i.display_name, type: qid && priv.has(qid) ? "private" : "public", website: i.homepage_url, ranking, origin: "robot", published: false, source_url: qid ? `http://www.wikidata.org/entity/${qid}` : i.id });
  }

  await inChunks(newCities, 500, (chunk) => db().from("cities").insert(chunk), "add cities");
  log(`Added ${newCities.length} cities`);
  await inChunks(inserts, 500, (chunk) => db().from("universities").insert(chunk), "add universities");
  log(`Added ${inserts.length} universities`);
  for (const u of updates) {
    const { error } = await db().from("universities").update(u.patch).eq("slug", u.slug);
    if (error) log(`  could not update ${u.slug}: ${error.message}`);
  }
  log(`Updated ${updates.length} universities already in the database`);

  // 5. Remove robot cities left without universities (the first seeding's regions and districts).
  const used = new Set((await all<{ city: string }>("universities", "city")).map((u) => u.city));
  const empty = (await all<{ slug: string; origin: string; published: boolean }>("cities", "slug, origin, published")).filter((c) => c.origin === "robot" && !c.published && !used.has(c.slug)).map((c) => c.slug);
  await inChunks(empty, 200, (chunk) => db().from("cities").delete().in("slug", chunk), "remove empty cities");
  log(`Removed ${empty.length} empty robot cities. Next: npm run robot -- discover-all`);
}
