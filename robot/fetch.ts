// Polite page fetching for the data robot:
// - says who it is (User-Agent with a contact link), so a university can reach us instead of blocking us
// - obeys robots.txt (cached per site), and never fetches a page the site asks robots to skip
// - waits between requests to the same site (default 4 s), one request at a time per site
// - asks "has this changed?" first (If-None-Match / If-Modified-Since), so unchanged pages cost almost nothing
// - gives up after 25 s or 4 MB

export const ROBOT_NAME = "amarAbroadBot";
const contact = process.env.ROBOT_CONTACT_URL || "https://github.com/amarabroad";
export const USER_AGENT = `${ROBOT_NAME}/0.1 (+${contact}; study-abroad info for Bangladeshi students)`;
const DELAY_MS = Number(process.env.ROBOT_DELAY_MS ?? 4000);
const TIMEOUT_MS = 25_000;
const MAX_BYTES = 4 * 1024 * 1024;

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number;
  notModified: boolean;
  /** "html" pages and "xml" sitemaps are read; anything else (PDF, images) is reported and skipped for now. */
  kind: "html" | "xml" | "other";
  body: string;
  etag: string | null;
  lastModified: string | null;
}

export class RobotsDisallowed extends Error {}

// ---------------------------------------------------------------- per-site queue

const lastHit = new Map<string, number>();
const queue = new Map<string, Promise<unknown>>();

/** Runs `task` after every earlier task for the same host, with DELAY_MS between them. */
function onHost<T>(host: string, task: () => Promise<T>): Promise<T> {
  const previous = queue.get(host) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const wait = (lastHit.get(host) ?? 0) + DELAY_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await task();
    } finally {
      lastHit.set(host, Date.now());
    }
  });
  queue.set(host, next);
  return next;
}

// ---------------------------------------------------------------- robots.txt

interface Rules {
  allow: string[];
  disallow: string[];
  crawlDelayMs: number | null;
}
const robotsCache = new Map<string, Promise<Rules>>();

/** Parses robots.txt and keeps the group for our bot, or "*" when there's none for us. */
export function parseRobots(text: string, agent = ROBOT_NAME): Rules {
  const groups: { agents: string[]; rules: Rules }[] = [];
  let current: { agents: string[]; rules: Rules } | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: { allow: [], disallow: [], crawlDelayMs: null } };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" && value) current.rules.allow.push(value);
    if (key === "disallow" && value) current.rules.disallow.push(value);
    if (key === "crawl-delay" && Number(value) > 0) current.rules.crawlDelayMs = Math.min(Number(value), 60) * 1000;
  }
  const mine = groups.find((g) => g.agents.some((a) => a !== "*" && agent.toLowerCase().includes(a)));
  return (mine ?? groups.find((g) => g.agents.includes("*")))?.rules ?? { allow: [], disallow: [], crawlDelayMs: null };
}

function patternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern).split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

/** Longest matching rule wins; Allow wins a tie (Google's interpretation). */
export function isAllowed(rules: Rules, path: string): boolean {
  let best = { length: -1, allow: true };
  for (const p of rules.allow) if (patternMatches(p, path) && p.length >= best.length) best = { length: p.length, allow: true };
  for (const p of rules.disallow) if (patternMatches(p, path) && p.length > best.length) best = { length: p.length, allow: false };
  return best.allow;
}

async function robotsFor(origin: string): Promise<Rules> {
  let rules = robotsCache.get(origin);
  if (!rules) {
    rules = (async () => {
      try {
        const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
        // 4xx: no rules. 5xx: be careful and treat the whole site as off limits for this run.
        if (res.status >= 500) return { allow: [], disallow: ["/"], crawlDelayMs: null };
        return res.ok ? parseRobots(await res.text()) : { allow: [], disallow: [], crawlDelayMs: null };
      } catch {
        return { allow: [], disallow: [], crawlDelayMs: null };
      }
    })();
    robotsCache.set(origin, rules);
  }
  return rules;
}

// ---------------------------------------------------------------- fetch

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

export async function politeFetch(url: string, previous: { etag?: string | null; lastModified?: string | null } = {}, accept = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5"): Promise<FetchResult> {
  const target = new URL(url);
  if (target.protocol !== "https:" && target.protocol !== "http:") throw new Error(`Not a web address: ${url}`);
  const rules = await robotsFor(target.origin);
  if (!isAllowed(rules, target.pathname + target.search)) throw new RobotsDisallowed(`robots.txt asks robots not to fetch ${url}`);
  if (rules.crawlDelayMs && rules.crawlDelayMs > DELAY_MS) lastHit.set(target.host, (lastHit.get(target.host) ?? 0) + rules.crawlDelayMs - DELAY_MS);

  return onHost(target.host, async () => {
    const headers: Record<string, string> = { "User-Agent": USER_AGENT, Accept: accept, "Accept-Language": "en;q=1, *;q=0.5" };
    // Some caches keep a stale compressed copy of sitemaps; asking for the plain file gets the current one.
    if (accept.includes("xml")) headers["Accept-Encoding"] = "identity";
    if (previous.etag) headers["If-None-Match"] = previous.etag;
    if (previous.lastModified) headers["If-Modified-Since"] = previous.lastModified;
    const res = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const type = res.headers.get("content-type") ?? "";
    const kind = /text\/html|application\/xhtml/.test(type) ? "html" : /xml/.test(type) ? "xml" : "other";
    const readable = res.status !== 304 && kind !== "other";
    if (!readable) await res.body?.cancel();
    return {
      url,
      finalUrl: res.url || url,
      status: res.status,
      notModified: res.status === 304,
      kind,
      body: readable ? await readCapped(res) : "",
      etag: res.headers.get("etag"),
      lastModified: res.headers.get("last-modified"),
    };
  });
}
