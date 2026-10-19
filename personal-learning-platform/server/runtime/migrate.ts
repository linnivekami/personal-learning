import type { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Applies migrations/*.sql in order, recording them in the same d1_migrations
// table Wrangler uses, so a database keeps its history across runtimes.
export function migrate(db: DatabaseSync, dir: string) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)",
  );
  const applied = new Set(
    (db.prepare("SELECT name FROM d1_migrations").all() as { name: string }[]).map(
      (r) => r.name,
    ),
  );
  const done: string[] = [];
  for (const name of readdirSync(dir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort()) {
    if (applied.has(name)) continue;
    const sql = readFileSync(join(dir, name), "utf8");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO d1_migrations(name) VALUES(?)").run(name);
      db.exec("COMMIT");
      done.push(name);
    } catch (e) {
      db.exec("ROLLBACK");
      throw new Error(
        `Migration ${name} failed: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
  return done;
}
