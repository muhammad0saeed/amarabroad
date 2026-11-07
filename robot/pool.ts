// Helpers that let the robot work on thousands of universities at once while staying polite to each website.

/** Stable number for a university, so each one always lands in the same shard (one shard per website keeps visits polite). */
export function shardOf(key: string, shards: number): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  return h % shards;
}

/** Alternate between universities, so parallel workers visit different websites instead of queueing on one. */
export function interleave<T extends { university: string | null }>(rows: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const key = r.university ?? "";
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }
  const lists = [...groups.values()];
  const out: T[] = [];
  for (let i = 0; out.length < rows.length; i++) for (const l of lists) if (l[i] !== undefined) out.push(l[i]!);
  return out;
}

/** Runs `work` on each item with `parallel` workers, taking no new item after `deadline` (a Date.now() value). */
export async function pool<T>(items: T[], parallel: number, deadline: number, work: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(parallel, queue.length)) }, async () => {
      for (let item = queue.shift(); item !== undefined && Date.now() < deadline; item = queue.shift()) await work(item);
    }),
  );
}
