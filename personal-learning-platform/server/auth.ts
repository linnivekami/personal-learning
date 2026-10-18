import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./auth-schema";
import type { Env } from "./env";
import { ApiError } from "./env";
export async function sendMail(
  env: Env,
  to: string,
  subject: string,
  text: string,
  id: string,
) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM)
    throw new ApiError(503, "EMAIL_NOT_CONFIGURED", "邮件服务尚未配置。");
  const day = new Date().toISOString().slice(0, 10);
  const attempt = await env.DB.prepare(
    "INSERT OR IGNORE INTO mail_deliveries(id,email,day,status,created_at) SELECT ?,?,?,'sending',? WHERE (SELECT COUNT(*) FROM mail_deliveries WHERE day=? AND status IN ('sending','sent'))<90",
  )
    .bind(id, to, day, new Date().toISOString(), day)
    .run();
  if (!attempt.meta.changes) {
    if (
      await env.DB.prepare("SELECT id FROM mail_deliveries WHERE id=?")
        .bind(id)
        .first()
    )
      return;
    throw new ApiError(
      429,
      "EMAIL_LIMIT",
      "今日邮件额度已用完，请使用其他登录或提醒方式。",
    );
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": id,
    },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text }),
  });
  await env.DB.prepare("UPDATE mail_deliveries SET status=?,error=? WHERE id=?")
    .bind(r.ok ? "sent" : "failed", r.ok ? null : `HTTP ${r.status}`, id)
    .run();
  if (!r.ok)
    throw new ApiError(502, "EMAIL_FAILED", "邮件暂时发送失败，请稍后重试。");
}
export function authFor(env: Env) {
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32)
    throw new ApiError(
      503,
      "AUTH_NOT_CONFIGURED",
      "账号服务尚未配置，请按部署向导设置认证密钥。",
    );
  return betterAuth({
    appName: "Personal Learning",
    baseURL: env.APP_ORIGIN,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.DB), { provider: "sqlite", schema }),
    trustedOrigins: env.APP_ORIGIN ? [env.APP_ORIGIN] : [],
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {},
    plugins: [
      emailOTP({
        expiresIn: 600,
        otpLength: 6,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp, type }) {
          await sendMail(
            env,
            email,
            "Personal Learning 登录验证码",
            `你的验证码是 ${otp}，10 分钟内有效。如果不是你本人操作，可以忽略。`,
            `${type}:${email}:${crypto.randomUUID()}`,
          );
        },
      }),
    ],
    rateLimit: { enabled: true, storage: "memory", window: 60, max: 30 },
    advanced: {
      useSecureCookies: env.APP_ENV !== "development",
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
    },
  });
}
