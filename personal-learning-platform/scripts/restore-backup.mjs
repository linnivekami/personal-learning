// Offline recovery tool: decrypts an administrator-downloaded R2 backup into
// reviewable SQL. It never connects to production or executes the result.
import { readFile, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { webcrypto } from "node:crypto";
const [directory, target] = process.argv.slice(2);
if (!directory || !target)
  throw new Error(
    "Usage: BETTER_AUTH_SECRET=... node scripts/restore-backup.mjs BACKUP_DIRECTORY OUTPUT.sql (set secret safely in your environment)",
  );
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) throw new Error("Missing decryption key in environment");
const manifest = JSON.parse(
  await readFile(resolve(directory, "manifest.json"), "utf8"),
);
if (manifest.version !== 1 || !Array.isArray(manifest.files))
  throw new Error("Unsupported backup manifest");
const allowed = new Set([
  "user",
  "account",
  "session",
  "verification",
  "profiles",
  "courses",
  "events",
  "notes",
  "sources",
  "materials",
  "activities",
  "purchases",
  "settings",
  "assessments",
  "lessons",
  "messages",
  "budgets",
  "reservations",
  "stored_objects",
  "teaching_decisions",
  "notifications",
  "push_subscriptions",
  "feedback",
  "mail_deliveries",
  "audit_log",
]);
const raw = await webcrypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`backup:v1:${secret}`),
  ),
  key = await webcrypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "decrypt",
  ]);
const quote = (v) =>
  v === null
    ? "NULL"
    : typeof v === "number"
      ? Number.isFinite(v)
        ? String(v)
        : (() => {
            throw new Error("Invalid number");
          })()
      : `'${String(v).replaceAll("'", "''")}'`;
const identifier = (s) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s))
    throw new Error("Invalid identifier");
  return `"${s}"`;
};
const sql = [
  "-- Restore into an EMPTY, migrated recovery database; inspect before use.",
  "PRAGMA defer_foreign_keys=ON;",
];
for (const file of manifest.files) {
  if (typeof file !== "string" || !file.endsWith(".enc"))
    throw new Error("Invalid backup file");
  const bytes = await readFile(resolve(directory, basename(file)));
  const plain = await webcrypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.subarray(0, 12) },
    key,
    bytes.subarray(12),
  );
  const chunk = JSON.parse(new TextDecoder().decode(plain));
  if (!allowed.has(chunk.table) || !Array.isArray(chunk.rows))
    throw new Error("Invalid backup table");
  for (const row of chunk.rows) {
    const columns = Object.keys(row);
    sql.push(
      `INSERT INTO ${identifier(chunk.table)} (${columns.map(identifier).join(",")}) VALUES (${columns.map((k) => quote(row[k])).join(",")});`,
    );
  }
}
sql.push(
  "INSERT INTO source_search(source_id,course_id,user_id,content) SELECT id,course_id,user_id,content FROM sources;",
  "PRAGMA foreign_key_check;",
);
await writeFile(resolve(target), sql.join("\n") + "\n", { mode: 0o600 });
console.log(
  "Decrypted SQL written privately. Inspect and restore into a new recovery database before any production change.",
);
