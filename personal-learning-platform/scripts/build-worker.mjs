import { build } from "esbuild";
import { readFile, writeFile, readdir, mkdir, cp } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};
const assets = {};
async function walk(dir, prefix = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name),
      url = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) await walk(path, url);
    else
      assets[url] = {
        type: types[extname(path)] ?? "application/octet-stream",
        body: (await readFile(path)).toString("base64"),
      };
  }
}
await walk(resolve(root, "dist/client"));
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
  plugins: [
    {
      name: "embedded-client",
      setup(build) {
        build.onLoad({ filter: /generated-assets\.ts$/ }, () => ({
          contents: `export const assets=${JSON.stringify(assets)};`,
          loader: "ts",
        }));
      },
    },
  ],
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
