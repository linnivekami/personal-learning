import { build } from "esbuild";
import { readFile, mkdir } from "node:fs/promises";
const assets = {};
for (const name of ["index.html", "runner.mjs", "python.mjs", "sql.mjs"])
  assets[`/sandbox/${name}`] = {
    type: name.endsWith(".html")
      ? "text/html; charset=utf-8"
      : "application/javascript",
    body: (await readFile(`public/sandbox/${name}`)).toString("base64"),
  };
await mkdir("dist/runner", { recursive: true });
await build({
  entryPoints: ["server/runner.ts"],
  outfile: "dist/runner/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  plugins: [
    {
      name: "sandbox-only",
      setup(build) {
        build.onLoad({ filter: /generated-assets\.ts$/ }, () => ({
          contents: `export const assets=${JSON.stringify(assets)}`,
          loader: "ts",
        }));
      },
    },
  ],
});
console.log(
  "Built isolated runner: 4 public files, no auth/database/model bindings.",
);
