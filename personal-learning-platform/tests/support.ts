import { createD1 } from "../server/runtime/d1";
import { migrate } from "../server/runtime/migrate";
import type { Env } from "../server/env";
// Tests run the Worker code against the same node:sqlite D1 adapter the Node
// (Fly.io) runtime uses, with an in-memory R2 stand-in.
export function testEnvironment() {
  const { d1, db } = createD1(":memory:");
  migrate(db, "migrations");
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
