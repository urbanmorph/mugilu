// A D1 database for tests: real SQLite (node:sqlite) behind D1's API, with the
// worker's migrations applied.
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";

const MIGRATIONS = new URL("../migrations/", import.meta.url);

export function testD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(MIGRATIONS).sort()) db.exec(readFileSync(new URL(f, MIGRATIONS), "utf8"));
  const statement = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => statement(sql, a),
    run: async () => {
      const r = db.prepare(sql).run(...(args as never[]));
      return { success: true, meta: { changes: Number(r.changes) } };
    },
    // D1 returns plain objects; node:sqlite rows have a null prototype.
    all: async () => ({
      success: true,
      results: db
        .prepare(sql)
        .all(...(args as never[]))
        .map((r) => ({ ...r })),
    }),
    first: async (col?: string) => {
      const row = db.prepare(sql).get(...(args as never[])) as Record<string, unknown> | undefined;
      return row ? (col ? row[col] : { ...row }) : null;
    },
  });
  return {
    prepare: (sql: string) => statement(sql),
    batch: async (stmts: { run: () => Promise<unknown> }[]) => {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  } as unknown as D1Database;
}
