import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
if (!existsSync(".dev.vars"))
  await writeFile(
    ".dev.vars",
    'APP_ENV="development"\nDEV_AUTH="1"\nAPP_ORIGIN="http://localhost:8787"\nSANDBOX_ORIGIN="http://localhost:8788"\nBETTER_AUTH_SECRET="local-development-only-not-for-production-123456"\n',
  );
const command = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn(command, args, {
      stdio: "inherit",
      env: {
        ...process.env,
        WRANGLER_SEND_METRICS: "false",
        CLOUDFLARE_CF_FETCH_ENABLED: "false",
      },
    });
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${args.join(" ")} failed`)),
    );
  });
await run(["run", "db:generate"]);
await run(["run", "build"]);
await run(["run", "db:migrate"]);
const runner = spawn(process.execPath, ["scripts/sandbox-server.mjs"], {
  stdio: "inherit",
});
const p = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--local",
    "--ip",
    "127.0.0.1",
    "--port",
    "8787",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: "false",
      CLOUDFLARE_CF_FETCH_ENABLED: "false",
      WRANGLER_LOG_PATH: ".wrangler/logs",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    p.kill(signal);
    runner.kill(signal);
  });
p.on("exit", (code) => process.exit(code ?? 0));
