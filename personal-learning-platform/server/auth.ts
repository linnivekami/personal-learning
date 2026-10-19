import { betterAuth } from "better-auth";
import { emailOTP, genericOAuth } from "better-auth/plugins";
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

export interface PathlineConfig {
  issuer: string;
  clientId: string;
  /** Pathline's public site, for "back to Pathline" links. */
  siteUrl: string;
  /** Must be registered exactly in Pathline's OIDC client list. */
  redirectURI: string;
}
/**
 * "Sign in with Pathline": Pathline is the OpenID Connect provider for
 * verified university students (Authorization Code + PKCE, public client,
 * ES256 ID tokens checked against Pathline's JWKS). Null when not configured.
 */
export function pathlineConfig(env: Env): PathlineConfig | null {
  const issuer = (env.PATHLINE_ISSUER ?? "").trim().replace(/\/+$/, "");
  const clientId = (env.PATHLINE_CLIENT_ID ?? "").trim();
  const origin = (env.APP_ORIGIN ?? "").replace(/\/+$/, "");
  if (!issuer || !clientId || !origin) return null;
  return {
    issuer,
    clientId,
    siteUrl: (env.PATHLINE_URL ?? issuer).trim().replace(/\/+$/, ""),
    redirectURI: `${origin}/api/auth/callback/pathline`,
  };
}

function createAuth(env: Env) {
  const pathline = pathlineConfig(env);
  return betterAuth({
    appName: "Personal Learning",
    baseURL: env.APP_ORIGIN,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.DB), { provider: "sqlite", schema }),
    trustedOrigins: env.APP_ORIGIN ? [env.APP_ORIGIN] : [],
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    // Pathline only asserts confirmed university addresses, so a learner who
    // first used an email code with the same address keeps one account.
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: pathline ? ["pathline"] : [],
      },
    },
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
      ...(pathline
        ? [
            genericOAuth({
              config: [
                {
                  providerId: "pathline",
                  name: "Pathline",
                  discoveryUrl: `${pathline.issuer}/.well-known/openid-configuration`,
                  requireIdTokenVerification: true,
                  clientId: pathline.clientId,
                  tokenEndpointAuth: { method: "none" },
                  pkce: true,
                  scopes: ["openid", "profile", "email"],
                  redirectURI: pathline.redirectURI,
                  mapProfileToUser: (profile) => ({
                    name:
                      (typeof profile.name === "string" && profile.name) ||
                      String(profile.email ?? "").split("@")[0] ||
                      "Pathline learner",
                    emailVerified: profile.email_verified === true,
                  }),
                },
              ],
            }),
          ]
        : []),
    ],
    rateLimit: { enabled: true, storage: "memory", window: 60, max: 30 },
    advanced: {
      // Only the edge's own header is trusted: cf-connecting-ip on Workers,
      // fly-client-ip on Fly (set CLIENT_IP_HEADER there).
      ipAddress: {
        ipAddressHeaders: [env.CLIENT_IP_HEADER ?? "cf-connecting-ip"],
      },
      useSecureCookies: env.APP_ENV !== "development",
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
    },
  });
}

// One instance per environment: plugin setup (including Pathline discovery)
// runs once, and the in-memory rate limit actually accumulates.
const instances = new WeakMap<
  Env,
  { key: string; auth: ReturnType<typeof createAuth> }
>();
export function authFor(env: Env) {
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32)
    throw new ApiError(
      503,
      "AUTH_NOT_CONFIGURED",
      "账号服务尚未配置，请按部署向导设置认证密钥。",
    );
  const key = [
    env.BETTER_AUTH_SECRET,
    env.APP_ORIGIN,
    env.APP_ENV,
    env.GOOGLE_CLIENT_ID,
    env.PATHLINE_ISSUER,
    env.PATHLINE_CLIENT_ID,
  ].join("\n");
  const cached = instances.get(env);
  if (cached?.key === key) return cached.auth;
  const auth = createAuth(env);
  instances.set(env, { key, auth });
  return auth;
}

/** Claims Pathline asserted at the last sign-in (verified on receipt). */
export async function pathlineClaims(env: Env, userId: string) {
  const row = await env.DB.prepare(
    "SELECT idToken FROM account WHERE userId=? AND providerId='pathline' ORDER BY updatedAt DESC LIMIT 1",
  )
    .bind(userId)
    .first<{ idToken: string | null }>();
  if (!row) return null;
  try {
    const part = (row.idToken ?? "").split(".")[1] ?? "";
    const claims = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(part.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
          c.charCodeAt(0),
        ),
      ),
    ) as { school?: unknown; pathline_status?: unknown };
    return {
      linked: true,
      school: typeof claims.school === "string" ? claims.school : null,
      verified: claims.pathline_status === "verified_student",
    };
  } catch {
    return { linked: true, school: null, verified: false };
  }
}

// Whether Pathline currently accepts this client: an authorization request
// for a registered client redirects (to sign-in or back to us), an unknown
// one is refused with 400. Checked at most every 10 minutes; no side effects.
const readiness = new Map<string, { at: number; ready: Promise<boolean> }>();
export function pathlineReady(env: Env): Promise<boolean> {
  const p = pathlineConfig(env);
  if (!p || !env.BETTER_AUTH_SECRET) return Promise.resolve(false);
  const key = `${p.issuer}\n${p.clientId}\n${p.redirectURI}`;
  const cached = readiness.get(key);
  if (cached && Date.now() - cached.at < 600_000) return cached.ready;
  const url = new URL(`${p.issuer}/oauth/authorize`);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: p.clientId,
    redirect_uri: p.redirectURI,
    scope: "openid",
    state: "readiness-check",
    code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    code_challenge_method: "S256",
  }).toString();
  const ready = fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  })
    .then((r) => r.status >= 300 && r.status < 400)
    .catch(() => false);
  readiness.set(key, { at: Date.now(), ready });
  // A failed check is retried after a minute rather than ten.
  void ready.then((ok) => {
    if (!ok) readiness.set(key, { at: Date.now() - 540_000, ready });
  });
  return ready;
}
