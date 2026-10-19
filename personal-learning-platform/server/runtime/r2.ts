import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// An R2Bucket over a private directory (a Fly volume in production). Each
// object is <sha256(key)>.bin plus a .json sidecar holding the key and
// metadata; an in-memory sorted index serves prefix listings.
interface Meta {
  key: string;
  size: number;
  etag: string;
  uploaded: string;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}
type PutValue =
  | string
  | ArrayBuffer
  | ArrayBufferView
  | Blob
  | ReadableStream
  | null;

async function toBytes(value: PutValue): Promise<Uint8Array> {
  if (value === null) return new Uint8Array();
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value))
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
  return new Uint8Array(await new Response(value).arrayBuffer());
}

export function createR2(dir: string) {
  mkdirSync(dir, { recursive: true });
  const index = new Map<string, Meta>();
  for (const name of readdirSync(dir))
    if (name.endsWith(".json"))
      try {
        const meta = JSON.parse(readFileSync(join(dir, name), "utf8")) as Meta;
        index.set(meta.key, meta);
      } catch {
        /* A torn sidecar is ignored; its object is unreachable. */
      }
  const file = (key: string) =>
    join(dir, createHash("sha256").update(key).digest("hex"));
  const object = (meta: Meta) => ({
    key: meta.key,
    size: meta.size,
    etag: meta.etag,
    httpEtag: `"${meta.etag}"`,
    uploaded: new Date(meta.uploaded),
    version: meta.etag,
    httpMetadata: meta.httpMetadata ?? {},
    customMetadata: meta.customMetadata ?? {},
    storageClass: "Standard",
    checksums: {},
    writeHttpMetadata(headers: Headers) {
      if (meta.httpMetadata?.contentType)
        headers.set("Content-Type", meta.httpMetadata.contentType);
    },
  });
  const atomic = (path: string, data: Uint8Array | string) => {
    const tmp = `${path}.${randomUUID()}.tmp`;
    writeFileSync(tmp, data);
    renameSync(tmp, path);
  };
  const bucket = {
    async head(key: string) {
      const meta = index.get(key);
      return meta ? object(meta) : null;
    },
    async get(key: string) {
      const meta = index.get(key);
      if (!meta) return null;
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(await readFile(`${file(key)}.bin`));
      } catch {
        return null;
      }
      return {
        ...object(meta),
        get body() {
          return new Blob([bytes as Uint8Array<ArrayBuffer>]).stream();
        },
        bodyUsed: false,
        async arrayBuffer() {
          return bytes.slice().buffer;
        },
        async bytes() {
          return bytes.slice();
        },
        async text() {
          return new TextDecoder().decode(bytes);
        },
        async json() {
          return JSON.parse(new TextDecoder().decode(bytes));
        },
        async blob() {
          return new Blob([bytes as Uint8Array<ArrayBuffer>], {
            type: meta.httpMetadata?.contentType,
          });
        },
      };
    },
    async put(
      key: string,
      value: PutValue,
      options?: {
        httpMetadata?: { contentType?: string } | Headers;
        customMetadata?: Record<string, string>;
      },
    ) {
      const bytes = await toBytes(value);
      const http =
        options?.httpMetadata instanceof Headers
          ? {
              contentType:
                options.httpMetadata.get("Content-Type") ?? undefined,
            }
          : options?.httpMetadata;
      const meta: Meta = {
        key,
        size: bytes.byteLength,
        etag: createHash("md5").update(bytes).digest("hex"),
        uploaded: new Date().toISOString(),
        httpMetadata: http,
        customMetadata: options?.customMetadata,
      };
      atomic(`${file(key)}.bin`, bytes);
      atomic(`${file(key)}.json`, JSON.stringify(meta));
      index.set(key, meta);
      return object(meta);
    },
    async delete(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        index.delete(key);
        rmSync(`${file(key)}.json`, { force: true });
        rmSync(`${file(key)}.bin`, { force: true });
      }
    },
    async list(options: { prefix?: string; cursor?: string; limit?: number } = {}) {
      const prefix = options.prefix ?? "",
        limit = Math.min(1000, Math.max(1, options.limit ?? 1000));
      const keys = [...index.keys()]
        .filter((k) => k.startsWith(prefix) && (!options.cursor || k > options.cursor))
        .sort();
      const page = keys.slice(0, limit);
      const truncated = keys.length > limit;
      return {
        objects: page.map((k) => object(index.get(k)!)),
        truncated,
        cursor: truncated ? page[page.length - 1] : undefined,
        delimitedPrefixes: [] as string[],
      };
    },
  };
  return bucket as unknown as R2Bucket;
}
