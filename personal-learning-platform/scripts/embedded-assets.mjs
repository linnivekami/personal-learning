import { readFile, readdir } from "node:fs/promises";
import { resolve, extname } from "node:path";

// The client build (dist/client) is embedded into the server bundles as
// base64, so one file serves the app on Workers and on Node.
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
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};
export async function clientAssets(dir) {
  const assets = {};
  async function walk(path, prefix = "") {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const full = resolve(path, entry.name),
        url = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) await walk(full, url);
      else
        assets[url] = {
          type: types[extname(full)] ?? "application/octet-stream",
          body: (await readFile(full)).toString("base64"),
        };
    }
  }
  await walk(dir);
  return assets;
}
export const embedAssets = (assets) => ({
  name: "embedded-client",
  setup(build) {
    build.onLoad({ filter: /generated-assets\.ts$/ }, () => ({
      contents: `export const assets=${JSON.stringify(assets)};`,
      loader: "ts",
    }));
  },
});
