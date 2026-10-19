// Shared setup for the gap-check browser tests. Paths are resolved from this
// file so the suite runs from any checkout, not just the author's machine.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, "../..");
export const htmlFile = path.join(root, "ISOM3770_Midterm_GapCheck.html");
export const url = pathToFileURL(htmlFile).href;
export const out = path.join(root, "isom3770-gapcheck", "test-output");

async function loadPlaywright() {
  const bundled = path.join(
    root,
    "personal-learning-platform/node_modules/playwright/index.mjs",
  );
  let lastError;
  for (const candidate of [pathToFileURL(bundled).href, "playwright"]) {
    try {
      return await import(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Playwright is required for the gap-check tests. Run "npm ci" in personal-learning-platform first.\n${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

export const { chromium } = await loadPlaywright();

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function ensureOutput() {
  fs.mkdirSync(out, { recursive: true });
  return out;
}
