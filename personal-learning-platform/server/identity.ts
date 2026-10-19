import type { Hono } from "hono";
import { authFor } from "./auth";
import { ApiError, now, type HonoEnv } from "./env";
import { run } from "./db";

// Every /api/v1 request resolves exactly one learner: the local developer,
// the hosting platform's signed-in owner, or a Better Auth session (email
// code, Google or Pathline). Admin rights come only from ADMIN_EMAILS.
export function installIdentity(app: Hono<HonoEnv>) {
  app.use("/api/v1/*", async (c, next) => {
    let userId: string | undefined,
      email: string | undefined,
      name: string | undefined;
    if (c.env.APP_ENV === "development" && c.env.DEV_AUTH === "1") {
      userId = "local-developer";
      email = "developer@localhost";
      name = "本地学习者";
    } else if (c.env.IDENTITY_MODE === "sites") {
      userId = c.req.header("oai-authenticated-user-id");
      email = c.req.header("oai-authenticated-user-email");
      name = email?.split("@")[0];
    }
    if (!userId && c.env.BETTER_AUTH_SECRET) {
      const result = await authFor(c.env).api.getSession({
        headers: c.req.raw.headers,
      });
      if (result) {
        userId = result.user.id;
        email = result.user.email;
        name = result.user.name;
      }
    }
    if (!userId || !email)
      throw new ApiError(401, "UNAUTHENTICATED", "请登录后保存和继续学习。");
    const admin =
      (c.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .includes(email.toLowerCase()) ||
      (c.env.APP_ENV === "development" && c.env.DEV_AUTH === "1");
    c.set("user", {
      id: userId,
      email,
      name: name ?? email.split("@")[0],
      admin,
    });
    await run(
      c.env,
      "INSERT OR IGNORE INTO profiles(user_id,email,name,created_at) VALUES(?,?,?,?)",
      userId,
      email,
      name ?? email,
      now(),
    );
    await next();
  });
}
