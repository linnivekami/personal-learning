import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { clientAssets, embedAssets } from "./embedded-assets.mjs";

// Single-file Node server (Fly.io / Docker): dependencies and the client
// build are bundled, so the image needs only Node, this file and migrations/.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const assets = await clientAssets(resolve(root, "dist/client"));
await mkdir(resolve(root, "dist/node"), { recursive: true });
await build({
  entryPoints: [resolve(root, "server/node.ts")],
  outfile: resolve(root, "dist/node/server.mjs"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  sourcemap: "linked",
  external: ["node:*"],
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
  plugins: [embedAssets(assets)],
  logLevel: "warning",
});
console.log(
  `Built Node server with ${Object.keys(assets).length} static assets.`,
);
