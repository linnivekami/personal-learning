import type { Hono } from "hono";
import type { HonoEnv, Env } from "./env";
import { ApiError } from "./env";
import { run } from "./db";
async function key(env: Env) {
  if (!env.BETTER_AUTH_SECRET)
    throw new ApiError(503, "AUTH_CONFIG", "认证服务未配置。");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.BETTER_AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function unsubscribeURL(env: Env, user: string) {
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await key(env),
      new TextEncoder().encode(`unsubscribe:${user}`),
    ),
  );
  return `${env.APP_ORIGIN}/unsubscribe?user=${encodeURIComponent(user)}&token=${Array.from(signature, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
export function installUnsubscribe(app: Hono<HonoEnv>) {
  app.get("/unsubscribe", (c) => {
    const u = new URL(c.req.url);
    c.header(
      "Content-Security-Policy",
      "default-src 'none'; form-action 'self'; frame-ancestors 'none'; style-src 'unsafe-inline'",
    );
    return c.html(
      `<html lang="en"><meta name="viewport" content="width=device-width"><title>Personal Learning · Email preferences</title><body style="font:18px system-ui;max-width:600px;margin:15vh auto;padding:24px"><h1>取消邮件提醒 / Unsubscribe</h1><p>停止学习提醒邮件。账号验证邮件仍按你的登录请求发送。<br>Stop learning reminders. Sign-in codes remain available when requested.</p><form method="POST" action="${escapeHTML(u.pathname + u.search)}"><button>取消订阅 / Unsubscribe</button></form></body></html>`,
    );
  });
  app.post("/unsubscribe", async (c) => {
    const user = c.req.query("user") ?? "",
      token = c.req.query("token") ?? "";
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new ApiError(400, "UNSUBSCRIBE_TOKEN", "取消订阅链接无效。");
    const signature = Uint8Array.from(token.match(/../g)!, (b) =>
      parseInt(b, 16),
    );
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        await key(c.env),
        signature,
        new TextEncoder().encode(`unsubscribe:${user}`),
      ))
    )
      throw new ApiError(400, "UNSUBSCRIBE_TOKEN", "取消订阅链接无效。");
    await run(
      c.env,
      "UPDATE profiles SET reminders=json_set(reminders,'$.email',json('false')) WHERE user_id=?",
      user,
    );
    return c.text(
      "已取消学习提醒邮件。You have unsubscribed from learning reminders.",
    );
  });
}
const escapeHTML = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
