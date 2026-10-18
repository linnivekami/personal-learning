import { build } from "esbuild";
import { mkdir, copyFile, cp, rm } from "node:fs/promises";
import { resolve } from "node:path";
const target = resolve("../personal-learning");
await mkdir(resolve(target, "scripts"), { recursive: true });
await mkdir(resolve(target, "shared"), { recursive: true });
await build({
  entryPoints: ["shared/index.ts"],
  outfile: resolve(target, "shared/engine.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  minify: true,
});
await copyFile(
  "shared/teaching-contract.md",
  resolve(target, "references/teaching-contract.md"),
);
await copyFile("shared/policy.json", resolve(target, "shared/policy.json"));
await copyFile("scripts/skill-state.mjs", resolve(target, "scripts/state.mjs"));
await mkdir("skill", { recursive: true });
for (const name of [
  "SKILL.md",
  "VERSION.md",
  "TEACHING-HANDOFF.md",
  "references",
  "assets",
  "scripts",
  "shared",
])
  await cp(resolve(target, name), resolve("skill", name), { recursive: true });
console.log(
  "Synchronized versioned teaching engine and policy into the Skill.",
);
