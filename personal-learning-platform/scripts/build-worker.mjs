import { build } from "esbuild";
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { clientAssets, embedAssets } from "./embedded-assets.mjs";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const assets = await clientAssets(resolve(root, "dist/client"));
await mkdir(resolve(root, "dist/server"), { recursive: true });
await mkdir(resolve(root, "dist/.openai"), { recursive: true });
await build({
  entryPoints: [resolve(root, "server/app.ts")],
  outfile: resolve(root, "dist/server/index.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  minify: true,
  sourcemap: false,
  external: ["node:*"],
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire("/worker/index.js");',
  },
  plugins: [embedAssets(assets)],
});
await cp(
  resolve(root, ".openai/hosting.json"),
  resolve(root, "dist/.openai/hosting.json"),
);
await cp(resolve(root, "drizzle"), resolve(root, "dist/.openai/drizzle"), {
  recursive: true,
});
const local = JSON.parse(
  await readFile(resolve(root, "wrangler.jsonc"), "utf8"),
);
local.main = "index.js";
local.d1_databases[0].migrations_dir = "../../migrations";
await writeFile(
  resolve(root, "dist/server/wrangler.json"),
  JSON.stringify(local, null, 2),
);
console.log(
  `Built Worker with ${Object.keys(assets).length} static assets. Private learning data is outside the build root.`,
);
