import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import type { Env } from "../server/env";
export function testEnvironment() {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.exec(readFileSync(`migrations/${file}`, "utf8"));
  const prepare = (sql: string) => {
    let args: unknown[] = [];
    const execute = () => {
      const statement = db.prepare(sql);
      const values = args as (string | number | null | Uint8Array)[];
      if (/^\s*(SELECT|PRAGMA|WITH)/i.test(sql) || /\bRETURNING\b/i.test(sql)) {
        const results = statement.all(...values);
        return {
          success: true,
          results,
          meta: { changes: 0, last_row_id: 0, duration: 0 },
        };
      }
      const r = statement.run(...values);
      return {
        success: true,
        results: [],
        meta: {
          changes: Number(r.changes),
          last_row_id: Number(r.lastInsertRowid),
          duration: 0,
        },
      };
    };
    const result = {
      bind(...params: unknown[]) {
        args = params;
        return result;
      },
      async all() {
        return execute();
      },
      async first(column?: string) {
        const row = execute().results[0] as Record<string, unknown> | undefined;
        return row ? (column ? row[column] : row) : null;
      },
      async run() {
        return execute();
      },
      async raw() {
        return execute().results.map((r) => Object.values(r));
      },
      execute,
    };
    return result;
  };
  const d1 = {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      db.exec("BEGIN");
      try {
        const result = statements.map((s) => s.execute());
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
  };
  const objects = new Map<
    string,
    {
      bytes: Uint8Array;
      contentType?: string;
      customMetadata?: Record<string, string>;
    }
  >();
  const bucket = {
    async put(
      key: string,
      value: string | Uint8Array | ArrayBuffer | Blob,
      opts?: {
        httpMetadata?: { contentType: string };
        customMetadata?: Record<string, string>;
      },
    ) {
      let bytes: Uint8Array;
      if (typeof value === "string") bytes = new TextEncoder().encode(value);
      else if (value instanceof Blob)
        bytes = new Uint8Array(await value.arrayBuffer());
      else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
      else bytes = value;
      objects.set(key, {
        bytes,
        ...{
          contentType: opts?.httpMetadata?.contentType,
          customMetadata: opts?.customMetadata,
        },
      });
      return { key };
    },
    async get(key: string) {
      const o = objects.get(key);
      if (!o) return null;
      return {
        key,
        size: o.bytes.length,
        body: new Blob([new Uint8Array(o.bytes)]).stream(),
        httpMetadata: { contentType: o.contentType },
        async arrayBuffer() {
          return o.bytes.slice().buffer;
        },
        async text() {
          return new TextDecoder().decode(o.bytes);
        },
      };
    },
    async head(key: string) {
      return objects.has(key) ? { key } : null;
    },
    async delete(key: string | string[]) {
      for (const k of Array.isArray(key) ? key : [key]) objects.delete(k);
    },
    async list({ prefix }: { prefix: string }) {
      return {
        objects: [...objects.keys()]
          .filter((k) => k.startsWith(prefix))
          .map((key) => ({ key })),
        truncated: false,
      };
    },
  };
  const env = {
    DB: d1,
    BUCKET: bucket,
    APP_ENV: "test",
    IDENTITY_MODE: "sites",
    APP_ORIGIN: "https://learning.test",
    ADMIN_EMAILS: "admin@learning.test",
  } as unknown as Env;
  return { env, db, objects, close: () => db.close() };
}
