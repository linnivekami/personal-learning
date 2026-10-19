// Streaming ZIP (stored entries with data descriptors): large private uploads
// never need to be accumulated inside a 128 MB Worker.
import type { Env } from "./env";
import { rows } from "./db";
const encoder = new TextEncoder();
const table = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const le = (length: number, fields: [number, number, number][]) => {
  const b = new Uint8Array(length),
    v = new DataView(b.buffer);
  for (const [offset, size, value] of fields)
    size === 2
      ? v.setUint16(offset, value, true)
      : v.setUint32(offset, value, true);
  return b;
};
export interface ZipEntry {
  name: string;
  body: ReadableStream<Uint8Array>;
}
export function zipStream(entries: AsyncIterable<ZipEntry>) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let offset = 0;
      const central: Uint8Array[] = [];
      let count = 0;
      const emit = (b: Uint8Array) => {
        offset += b.length;
        controller.enqueue(b);
      };
      try {
        for await (const entry of entries) {
          const name = encoder.encode(entry.name),
            start = offset;
          emit(
            le(30, [
              [0, 4, 0x04034b50],
              [4, 2, 20],
              [6, 2, 0x808],
              [26, 2, name.length],
            ]),
          );
          emit(name);
          let crc = 0xffffffff,
            size = 0;
          const reader = entry.body.getReader();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.length;
            for (const byte of value)
              crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
            emit(value);
          }
          crc = (crc ^ 0xffffffff) >>> 0;
          emit(
            le(16, [
              [0, 4, 0x08074b50],
              [4, 4, crc],
              [8, 4, size],
              [12, 4, size],
            ]),
          );
          const header = le(46, [
            [0, 4, 0x02014b50],
            [4, 2, 20],
            [6, 2, 20],
            [8, 2, 0x808],
            [16, 4, crc],
            [20, 4, size],
            [24, 4, size],
            [28, 2, name.length],
            [42, 4, start],
          ]);
          const all = new Uint8Array(header.length + name.length);
          all.set(header);
          all.set(name, header.length);
          central.push(all);
          count++;
        }
        const start = offset;
        for (const b of central) emit(b);
        const length = offset - start;
        emit(
          le(22, [
            [0, 4, 0x06054b50],
            [8, 2, count],
            [10, 2, count],
            [12, 4, length],
            [16, 4, start],
          ]),
        );
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}
export async function* accountEntries(
  env: Env,
  user: string,
  data: unknown,
): AsyncGenerator<ZipEntry> {
  yield {
    name: "personal-learning-export.json",
    body: new Blob([JSON.stringify(data, null, 2)]).stream(),
  };
  let cursor: string | undefined;
  do {
    const list = await env.BUCKET.list({ prefix: `${user}/`, cursor });
    for (const file of list.objects) {
      const object = await env.BUCKET.get(file.key);
      if (object)
        yield {
          name: `files/${file.key.slice(user.length + 1)}`,
          body: object.body,
        };
    }
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
}
export async function exportData(env: Env, user: string) {
  const data: Record<string, unknown> = {
    format: "personal-learning",
    version: 2,
    policy: "2.0.0",
    exportedAt: new Date().toISOString(),
  };
  for (const table of [
    "profiles",
    "courses",
    "events",
    "notes",
    "materials",
    "sources",
    "cheat_sheets",
    "activities",
    "purchases",
    "teaching_decisions",
    "stored_objects",
  ])
    data[table] = await rows(
      env,
      `SELECT * FROM ${table} WHERE user_id=?`,
      user,
    );
  return data;
}
