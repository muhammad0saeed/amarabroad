// Runs the three Supabase SQL files on an in-memory Postgres (PGlite) and checks the rules:
// the seed loads, re-running is safe, visitors only read published rows, admins can do their job.
// Supabase's roles and auth.jwt() are replaced by small stand-ins.

import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

const sqlFile = (name: string) => readFileSync(new URL(`../supabase/${name}`, import.meta.url), "utf8");
let db: PGlite;
const count = async (sql: string) => Number((await db.query<{ n: string }>(sql)).rows[0]!.n);
async function as(role: "anon" | "authenticated" | "owner", email: string | null, fn: () => Promise<void>) {
  if (role !== "owner") await db.exec(`set role ${role}; set test.jwt = '${email ? JSON.stringify({ email }) : ""}'`);
  try {
    await fn();
  } finally {
    await db.exec("reset role; set test.jwt = ''");
  }
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    create schema auth; grant usage on schema auth to anon, authenticated;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb $$;
    grant execute on function auth.jwt() to anon, authenticated;
  `);
  // Twice: pasting a file again must be harmless.
  for (let run = 0; run < 2; run++) for (const f of ["01_schema.sql", "02_security.sql", "03_seed.sql"]) await db.exec(sqlFile(f));
}, 60_000);

describe("schema and seed", () => {
  it("loads every sample record", async () => {
    expect(await count("select count(*) n from programs")).toBe(42);
    expect(await count("select count(*) n from universities")).toBe(12);
    expect(await count("select count(*) n from scholarships")).toBe(6);
    expect(await count("select count(*) n from cities where photo->>'src' like '/photos/%'")).toBe(6);
  });

  it("derives filter columns from the nested data", async () => {
    expect(await count("select count(*) n from programs where cardinality(intake_months) = 0")).toBe(0);
    expect(await count("select count(*) n from programs where ielts_min is not null")).toBeGreaterThan(20);
  });

  it("won't publish an incomplete program, but keeps it as a draft", async () => {
    await expect(
      db.exec("insert into programs (slug, university, title, degree_level, official_url, published) values ('x-pub','sample-university-of-milan','X','master','https://x.example', true)"),
    ).rejects.toThrow(/programs_complete/);
    await db.exec("insert into programs (slug, university, title, degree_level, official_url) values ('x-draft','sample-university-of-milan','Draft','master','https://x.example')");
    expect(await count("select count(*) n from programs where slug = 'x-draft' and not published")).toBe(1);
  });

  it("finds titles with typos (trigram search)", async () => {
    expect(await count("select count(*) n from programs where title % 'data sciense'")).toBeGreaterThan(0);
  });
});

describe("row-level security", () => {
  it("visitors read only published content", async () => {
    await as("anon", null, async () => {
      expect(await count("select count(*) n from programs")).toBe(42);
      expect(await count("select count(*) n from programs where slug = 'x-draft'")).toBe(0);
    });
  });

  it("visitors can't write anything or see reports and robot data", async () => {
    await as("anon", null, async () => {
      expect((await db.query("update programs set title = 'hacked' where true returning slug")).rows).toHaveLength(0);
      await expect(db.exec("insert into wrong_info_reports (topic, correction) values ('other', 'this is wrong info')")).rejects.toThrow();
      await expect(db.exec("select * from sources")).rejects.toThrow();
      await expect(db.exec("select * from admins")).rejects.toThrow();
    });
  });

  it("signed-in strangers get nothing extra", async () => {
    await as("authenticated", "stranger@example.com", async () => {
      expect(await count("select count(*) n from wrong_info_reports")).toBe(0);
      expect((await db.query("update programs set title = 'x' where true returning slug")).rows).toHaveLength(0);
    });
  });

  it("admins see drafts and reports and can edit", async () => {
    await db.exec("insert into admins (email) values ('admin@example.com') on conflict do nothing");
    await db.exec("insert into wrong_info_reports (topic, correction) values ('deadline', 'The deadline moved to March.')");
    await as("authenticated", "Admin@Example.com", async () => {
      expect(await count("select count(*) n from programs where slug = 'x-draft'")).toBe(1);
      expect(await count("select count(*) n from wrong_info_reports")).toBe(1);
      expect((await db.query("update programs set title = title where slug = 'stub-msc-data-science' returning slug")).rows).toHaveLength(1);
      expect((await db.query("update wrong_info_reports set status = 'fixed' returning id")).rows).toHaveLength(1);
    });
  });
});

describe("seed file", () => {
  it("is up to date with data/*.json (run npm run db:seed after editing the JSON)", async () => {
    const before = sqlFile("03_seed.sql");
    const { execFileSync } = await import("node:child_process");
    execFileSync(process.execPath, ["scripts/build-seed.mjs"]);
    expect(sqlFile("03_seed.sql")).toBe(before);
  });
});
