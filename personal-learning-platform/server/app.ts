import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { authFor, pathlineConfig, pathlineReady } from "./auth";
import { ApiError, uid, now, json, type HonoEnv, type Env } from "./env";
import { first } from "./db";
import { policy } from "../shared/core";
import { limitsFor } from "./quota";
import { installIdentity } from "./identity";
import { installAccountRoutes } from "./routes/account";
import { installCourseRoutes } from "./routes/courses";
import { installCheatSheetRoutes } from "./routes/cheatsheets";
import { installTeachingRoutes } from "./routes/teaching";
import { installNoteRoutes } from "./routes/notes";
import { installRewardRoutes } from "./routes/rewards";
import { installAdminRoutes } from "./routes/admin";
import { installMediaRoutes } from "./media";
import { installUnsubscribe } from "./unsubscribe";
import { installStatic } from "./static";
import { processDueJobs, handleQueue } from "./jobs";

export const app = new Hono<HonoEnv>();
app.use("*", async (c, next) => {
  c.set("requestId", uid());
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=()",
  );
  if (new URL(c.req.url).protocol === "https:")
    c.header("Strict-Transport-Security", "max-age=31536000");
  if (c.req.path.startsWith("/api")) c.header("Cache-Control", "no-store");
});
app.onError((e, c) => {
  if (e instanceof ApiError)
    return c.json(
      {
        error: {
          code: e.code,
          message: e.message,
          requestId: c.get("requestId"),
        },
      },
      e.status as 400,
    );
  if (e instanceof z.ZodError)
    return c.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "输入格式不正确。",
          details: e.issues.map((i) => ({ path: i.path, message: i.message })),
        },
      },
      400,
    );
  console.error(
    JSON.stringify({
      requestId: c.get("requestId"),
      name: e.name,
      message: e.message,
    }),
  );
  return c.json(
    {
      error: {
        code: "INTERNAL",
        message: "暂时无法完成操作，请重试。",
        requestId: c.get("requestId"),
      },
    },
    500,
  );
});
app.use(
  "/internal/*",
  bodyLimit({
    maxSize: 31 * 1024 * 1024,
    onError: (c) =>
      c.json(
        { error: { code: "BODY_TOO_LARGE", message: "转换回调超过限制。" } },
        413,
      ),
  }),
);
app.use(
  "/api/*",
  bodyLimit({
    maxSize: 22 * 1024 * 1024,
    onError: (c) =>
      c.json(
        { error: { code: "FILE_TOO_LARGE", message: "请求不能超过 22MB。" } },
        413,
      ),
  }),
);
app.use("/api/*", async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("Origin");
    const expected = c.env.APP_ORIGIN ?? new URL(c.req.url).origin;
    if (
      origin &&
      origin !== expected &&
      !(
        c.env.APP_ENV === "development" &&
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
      )
    )
      throw new ApiError(403, "ORIGIN", "请求来源不被允许。");
  }
  await next();
});
app.get("/api/v1/health", (c) =>
  c.json({ ok: true, policy: policy.version, time: now() }),
);
app.get("/api/v1/config", async (c) => c.json(await configuration(c.env)));
app.on(["GET", "POST"], "/api/auth/*", (c) =>
  authFor(c.env).handler(c.req.raw),
);
installIdentity(app);
installAccountRoutes(app);
installCourseRoutes(app);
installCheatSheetRoutes(app);
installTeachingRoutes(app);
installNoteRoutes(app);
installRewardRoutes(app);
installAdminRoutes(app);
installMediaRoutes(app);
installUnsubscribe(app);
installStatic(app);

async function configuration(env: Env) {
  const pathline = pathlineConfig(env);
  return {
    policyVersion: policy.version,
    development: env.APP_ENV === "development",
    releaseStage: env.RELEASE_STAGE ?? "production",
    identityMode: env.IDENTITY_MODE ?? "app",
    services: {
      model: !!env.DEEPSEEK_API_KEY,
      voice: !!env.DASHSCOPE_API_KEY,
      email: !!(env.RESEND_API_KEY && env.MAIL_FROM),
      google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      pathline: await pathlineReady(env),
      auth: !!env.BETTER_AUTH_SECRET,
      converter: !!(env.CONVERTER_URL && env.CONVERTER_TOKEN),
      push: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
      sandbox: !!env.SANDBOX_ORIGIN,
    },
    // Where "Back to Pathline" links go; sign-in itself uses the issuer.
    pathlineUrl: pathline?.siteUrl ?? null,
    pathlineConfigured: !!pathline,
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null,
    sandboxOrigin: env.SANDBOX_ORIGIN ?? null,
    limits: await limitsFor(env),
    budget: {
      ...policy.budget,
      ...json(
        (
          await first<{ value: string }>(
            env,
            "SELECT value FROM settings WHERE key='budget'",
          )
        )?.value,
        {},
      ),
    },
  };
}

export default {
  fetch: app.fetch,
  scheduled: async (
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) => ctx.waitUntil(processDueJobs(env)),
  queue: handleQueue,
};
