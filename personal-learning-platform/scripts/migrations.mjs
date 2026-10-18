import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
await mkdir("drizzle/meta", { recursive: true });
const files = (await readdir("migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();
const entries = [];
for (const [idx, file] of files.entries()) {
  const sql = await readFile(`migrations/${file}`, "utf8"),
    tag = `${String(idx).padStart(4, "0")}_${file.replace(/^\d+_|\.sql$/g, "")}`,
    target = `drizzle/${tag}.sql`;
  const source = sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `${s};`)
    .join("\n--> statement-breakpoint\n");
  if (existsSync(target)) {
    if ((await readFile(target, "utf8")) !== source)
      throw new Error(
        `Migration ${file} changed after generation. Append a migration instead.`,
      );
  } else await writeFile(target, source);
  entries.push({
    idx,
    version: "6",
    when: 1792281600000 + idx,
    tag,
    breakpoints: true,
  });
}
await writeFile(
  "drizzle/meta/_journal.json",
  JSON.stringify({ version: "7", dialect: "sqlite", entries }, null, 2),
);
console.log("Migration SQL and immutable journal are ready.");
