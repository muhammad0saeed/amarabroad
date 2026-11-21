// What amarAbroad covers (decided 22 Nov 2026): the best universities, complete, instead of many universities
// with a few programs each. Bangladeshi students mostly go abroad for a master's, so master's programs only.
//   - universities ranked in the world's top 700 (OpenAlex research rank), plus
//   - the top 3 of every country, so all 30 countries stay (Latvia, Lithuania and Malta have none in the top 700).
// Universities ranked 701-1000 and bachelor's programs were hidden, not deleted (published = false, page records
// "paused"); everything ranked below 1000 was deleted. To widen the scope, change these numbers and re-seed.

export const SCOPE = { worldRank: 700, countryRank: 3, levels: ["master"] as const };

/** PostgREST filter for universities inside the scope: `.or(SCOPE_FILTER)`. */
export const SCOPE_FILTER = `ranking->rank.lte.${SCOPE.worldRank},ranking->country_rank.lte.${SCOPE.countryRank}`;

/** True when a university with this ranking is inside the scope. */
export function inScope(ranking: { rank?: number | null; country_rank?: number | null } | null | undefined): boolean {
  if (!ranking) return false;
  return (ranking.rank ?? Infinity) <= SCOPE.worldRank || (ranking.country_rank ?? Infinity) <= SCOPE.countryRank;
}

/** True for a degree level the site lists. */
export const levelInScope = (level: string | null | undefined): boolean => (SCOPE.levels as readonly string[]).includes(level ?? "");
