import { DatabaseSync, type StatementSync } from "node:sqlite";

// A D1Database over node:sqlite, so the Worker code runs unchanged on Node
// (Fly.io) and in tests. Statements are synchronous; batches are transactions.
type Value = null | number | bigint | string | Uint8Array;
interface Result {
  success: true;
  results: Record<string, unknown>[];
  meta: {
    changes: number;
    last_row_id: number;
    duration: number;
    rows_read: number;
    rows_written: number;
  };
}
function value(v: unknown): Value {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v))
    return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  if (typeof v === "number" || typeof v === "bigint" || typeof v === "string")
    return v;
  throw new TypeError(`D1_TYPE_ERROR: type '${typeof v}' is not supported`);
}
const returnsRows = (s: StatementSync, sql: string) => {
  try {
    return s.columns().length > 0;
  } catch {
    return /^\s*(SELECT|PRAGMA|WITH|VALUES)\b/i.test(sql) || /\bRETURNING\b/i.test(sql);
  }
};

class Statement {
  constructor(
    private db: DatabaseSync,
    private cache: Map<string, StatementSync>,
    readonly sql: string,
    private args: Value[] = [],
  ) {}
  private statement() {
    let s = this.cache.get(this.sql);
    if (!s) {
      s = this.db.prepare(this.sql);
      this.cache.set(this.sql, s);
    }
    return s;
  }
  bind(...params: unknown[]) {
    return new Statement(this.db, this.cache, this.sql, params.map(value));
  }
  execute(): Result {
    const started = performance.now(),
      s = this.statement();
    s.setReturnArrays(false);
    if (returnsRows(s, this.sql)) {
      const results = s.all(...this.args) as Record<string, unknown>[];
      return {
        success: true,
        results,
        meta: {
          changes: /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(this.sql)
            ? results.length
            : 0,
          last_row_id: 0,
          duration: performance.now() - started,
          rows_read: results.length,
          rows_written: 0,
        },
      };
    }
    const r = s.run(...this.args);
    return {
      success: true,
      results: [],
      meta: {
        changes: Number(r.changes),
        last_row_id: Number(r.lastInsertRowid),
        duration: performance.now() - started,
        rows_read: 0,
        rows_written: Number(r.changes),
      },
    };
  }
  async all() {
    return this.execute();
  }
  async run() {
    return this.execute();
  }
  async first(column?: string) {
    const row = this.execute().results[0];
    if (!row) return null;
    return column ? (row[column] ?? null) : row;
  }
  async raw(options?: { columnNames?: boolean }) {
    const s = this.statement();
    s.setReturnArrays(true);
    try {
      const rows = s.all(...this.args) as unknown as unknown[][];
      if (!options?.columnNames) return rows;
      return [s.columns().map((c) => c.name), ...rows];
    } finally {
      s.setReturnArrays(false);
    }
  }
}

export function createD1(path: string) {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys=ON");
  if (path !== ":memory:") {
    db.exec("PRAGMA journal_mode=WAL");
    db.exec("PRAGMA synchronous=NORMAL");
    db.exec("PRAGMA busy_timeout=5000");
  }
  const cache = new Map<string, StatementSync>();
  const d1 = {
    prepare: (sql: string) => new Statement(db, cache, sql),
    async batch(statements: Statement[]) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((s) => s.execute());
        db.exec("COMMIT");
        return results;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    async exec(sql: string) {
      const started = performance.now();
      db.exec(sql);
      return {
        count: sql.split(";").filter((s) => s.trim()).length,
        duration: performance.now() - started,
      };
    },
    async dump(): Promise<ArrayBuffer> {
      throw new Error("dump is not supported by the Node runtime");
    },
    withSession() {
      return d1;
    },
  };
  return {
    d1: d1 as unknown as D1Database,
    db,
    close: () => db.close(),
  };
}
