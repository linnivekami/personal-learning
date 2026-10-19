import { createServer, type IncomingMessage } from "node:http";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { app } from "./app";
import { authFor } from "./auth";
import type { Env } from "./env";
import { processDueJobs, processJob } from "./jobs";
import { createD1 } from "./runtime/d1";
import { createR2 } from "./runtime/r2";
import { migrate } from "./runtime/migrate";
import runner from "./runner";

// Node entry (Fly.io): one process serves the app, runs the minute cron and
// processes background jobs in-process. Data lives under DATA_DIR (a volume).
const stringKeys = [
  "APP_ENV",
  "RELEASE_STAGE",
  "IDENTITY_MODE",
  "DEV_AUTH",
  "APP_ORIGIN",
  "SANDBOX_ORIGIN",
  "BETTER_AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "PATHLINE_ISSUER",
  "PATHLINE_CLIENT_ID",
  "PATHLINE_URL",
  "RESEND_API_KEY",
  "MAIL_FROM",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "DASHSCOPE_API_KEY",
  "DASHSCOPE_BASE_URL",
  "CONVERTER_URL",
  "CONVERTER_TOKEN",
  "ADMIN_EMAILS",
  "CLIENT_IP_HEADER",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "MONTHLY_BUDGET_FEN",
] as const;

if (process.env.RUNNER_ONLY === "1") startRunner();
else startApp();

// Code-practice runtime on its own origin: only /sandbox/ files, no
// database, sign-in or keys (see server/runner.ts).
function startRunner() {
  const origin = process.env.APP_ORIGIN ?? "http://localhost:8787";
  const port = Number(process.env.PORT ?? 8788);
  createServer(async (req, res) => {
    const r = await runner.fetch(
      new Request(
        new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`),
      ),
      { APP_ORIGIN: origin },
    );
    const headers: Record<string, string> = {};
    r.headers.forEach((v, k) => (headers[k] = v));
    res.writeHead(r.status, headers);
    res.end(Buffer.from(await r.arrayBuffer()));
  }).listen(port, "0.0.0.0", () =>
    console.log(`Learning runtime on :${port} for ${origin}`),
  );
}

function startApp() {
  const dataDir = resolve(process.env.DATA_DIR ?? ".data/node");
  mkdirSync(dataDir, { recursive: true });
  const database = createD1(join(dataDir, "learning.db"));
  const applied = migrate(
    database.db,
    resolve(process.env.MIGRATIONS_DIR ?? "migrations"),
  );
  if (applied.length) console.log(`Applied migrations: ${applied.join(", ")}`);

  const env = {
    DB: database.d1,
    BUCKET: createR2(join(dataDir, "objects")),
  } as Env;
  for (const key of stringKeys)
    if (process.env[key])
      (env as unknown as Record<string, string>)[key] = process.env[key]!;
  env.SANDBOX_ORIGIN ??= env.APP_ORIGIN;
  const failed = (what: string) => (e: unknown) =>
    console.error(
      JSON.stringify({
        what,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
  env.TASKS = {
    async send(body: { jobId: string }, options?: { delaySeconds?: number }) {
      setTimeout(
        () => void processJob(env, body.jobId).catch(failed("job")),
        (options?.delaySeconds ?? 0) * 1000,
      ).unref();
    },
    async sendBatch(messages: { body: { jobId: string } }[]) {
      for (const m of messages) await env.TASKS!.send(m.body);
    },
  } as unknown as Queue;

  const pending = new Set<Promise<unknown>>();
  const context = {
    waitUntil(p: Promise<unknown>) {
      pending.add(p);
      void p.catch(failed("waitUntil")).finally(() => pending.delete(p));
    },
    passThroughOnException() {},
    props: {},
  } as unknown as ExecutionContext;

  function toRequest(req: IncomingMessage) {
    const base = env.APP_ORIGIN ?? `http://${req.headers.host ?? "localhost"}`;
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers))
      if (value !== undefined)
        headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    const method = req.method ?? "GET";
    return new Request(new URL(req.url ?? "/", base), {
      method,
      headers,
      body:
        method === "GET" || method === "HEAD"
          ? undefined
          : (Readable.toWeb(req) as ReadableStream),
      duplex: "half",
    } as RequestInit);
  }

  const server = createServer(async (req, res) => {
    let response: Response;
    try {
      response = await app.fetch(toRequest(req), env, context);
    } catch (e) {
      failed("request")(e);
      response = new Response("Internal error", { status: 500 });
    }
    const headers: Record<string, string | string[]> = {};
    response.headers.forEach((value, name) => {
      if (name !== "set-cookie") headers[name] = value;
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) headers["set-cookie"] = cookies;
    res.writeHead(response.status, headers);
    if (!response.body || req.method === "HEAD") return res.end();
    const body = Readable.fromWeb(response.body as never);
    res.on("close", () => body.destroy());
    body.on("error", () => res.destroy());
    body.pipe(res);
  });

  const port = Number(process.env.PORT ?? 8787);
  server.listen(port, "0.0.0.0", () => {
    console.log(`Personal Learning on :${port} (data ${dataDir})`);
    // Load Pathline discovery before the first learner arrives.
    if (env.BETTER_AUTH_SECRET)
      void Promise.resolve()
        .then(() => authFor(env).$context)
        .catch(failed("auth"));
  });
  const cron = setInterval(
    () => void processDueJobs(env).catch(failed("cron")),
    60_000,
  );
  const shutdown = () => {
    clearInterval(cron);
    server.close(() => {
      void Promise.allSettled([...pending]).then(() => {
        database.close();
        process.exit(0);
      });
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
