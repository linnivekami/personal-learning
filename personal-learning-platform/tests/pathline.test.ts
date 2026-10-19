import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../server/app";
import { testEnvironment } from "./support";

// A stand-in for Pathline's OpenID Connect provider (src/lib/oidc/provider.ts
// in Pathline): discovery, ES256 JWKS, PKCE-bound single-use codes.
const ISSUER = "https://pathline.test";
const ORIGIN = "https://learning.test";
const CALLBACK = `${ORIGIN}/api/auth/callback/pathline`;
const b64url = (b: ArrayBuffer | Uint8Array | string) =>
  Buffer.from(typeof b === "string" ? b : new Uint8Array(b)).toString(
    "base64url",
  );

async function provider(options: { forgeSignature?: boolean } = {}) {
  const keys = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const forger = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = {
    ...(await crypto.subtle.exportKey("jwk", keys.publicKey)),
    kid: "test-key",
    use: "sig",
    alg: "ES256",
  };
  const codes = new Map<
    string,
    { challenge: string; nonce: string | null; redirect: string }
  >();
  const sign = async (payload: Record<string, unknown>) => {
    const head = b64url(
      JSON.stringify({ alg: "ES256", typ: "JWT", kid: "test-key" }),
    );
    const body = b64url(JSON.stringify(payload));
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      (options.forgeSignature ? forger : keys).privateKey,
      new TextEncoder().encode(`${head}.${body}`),
    );
    return `${head}.${body}.${b64url(signature)}`;
  };
  const tokenRequests: URLSearchParams[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== ISSUER) throw new Error(`unexpected fetch ${url}`);
    if (url.pathname === "/.well-known/openid-configuration")
      return Response.json({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/oauth/authorize`,
        token_endpoint: `${ISSUER}/oauth/token`,
        jwks_uri: `${ISSUER}/oauth/jwks`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        id_token_signing_alg_values_supported: ["ES256"],
        token_endpoint_auth_methods_supported: ["none"],
        code_challenge_methods_supported: ["S256"],
        scopes_supported: ["openid", "profile", "email"],
      });
    if (url.pathname === "/oauth/jwks") return Response.json({ keys: [jwk] });
    if (url.pathname === "/oauth/authorize")
      return url.searchParams.get("client_id") === "personal-learning"
        ? new Response(null, {
            status: 302,
            headers: { Location: `${ISSUER}/login` },
          })
        : new Response("Unknown client.", { status: 400 });
    if (url.pathname === "/oauth/token") {
      const raw =
        input instanceof Request
          ? await input.text()
          : String(init?.body ?? "");
      const form = new URLSearchParams(raw);
      tokenRequests.push(form);
      const code = codes.get(form.get("code") ?? "");
      codes.delete(form.get("code") ?? "");
      const verifier = form.get("code_verifier") ?? "";
      const challenge = b64url(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(verifier),
        ),
      );
      if (
        !code ||
        code.challenge !== challenge ||
        form.get("client_id") !== "personal-learning" ||
        form.get("redirect_uri") !== code.redirect
      )
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      const now = Math.floor(Date.now() / 1000);
      const claims = {
        iss: ISSUER,
        sub: "pathline-user-1",
        email: "student@connect.ust.hk",
        email_verified: true,
        name: null,
        school: "hkust",
        pathline_status: "verified_student",
        iat: now,
        exp: now + 3600,
      };
      return Response.json({
        access_token: await sign({ ...claims, aud: "learning-api" }),
        token_type: "Bearer",
        expires_in: 3600,
        id_token: await sign({
          ...claims,
          aud: "personal-learning",
          ...(code.nonce ? { nonce: code.nonce } : {}),
        }),
        scope: "openid profile email",
      });
    }
    return new Response("not found", { status: 404 });
  });
  // What Pathline's /oauth/authorize does for a signed-in verified student.
  const authorize = (location: string) => {
    const u = new URL(location);
    expect(u.origin + u.pathname).toBe(`${ISSUER}/oauth/authorize`);
    expect(u.searchParams.get("client_id")).toBe("personal-learning");
    expect(u.searchParams.get("redirect_uri")).toBe(CALLBACK);
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("scope")?.split(" ")).toContain("openid");
    const code = crypto.randomUUID();
    codes.set(code, {
      challenge: u.searchParams.get("code_challenge") ?? "",
      nonce: u.searchParams.get("nonce"),
      redirect: u.searchParams.get("redirect_uri") ?? "",
    });
    return `${CALLBACK}?code=${code}&state=${encodeURIComponent(u.searchParams.get("state") ?? "")}&iss=${encodeURIComponent(ISSUER)}`;
  };
  return { fetch, authorize, tokenRequests };
}

function environment() {
  const t = testEnvironment();
  Object.assign(t.env, {
    IDENTITY_MODE: "app",
    APP_ORIGIN: ORIGIN,
    BETTER_AUTH_SECRET: "synthetic-pathline-test-secret-at-least-32-chars",
    PATHLINE_ISSUER: ISSUER,
    PATHLINE_CLIENT_ID: "personal-learning",
    PATHLINE_URL: "https://pathline.example",
  });
  return t;
}
const cookies = (r: Response, jar = new Map<string, string>()) => {
  for (const c of r.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const [name, ...rest] = pair.split("=");
    jar.set(name.trim(), rest.join("="));
  }
  return jar;
};
const header = (jar: Map<string, string>) =>
  [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

async function signIn(
  t: ReturnType<typeof environment>,
  idp: Awaited<ReturnType<typeof provider>>,
) {
  const start = await app.request(
    `${ORIGIN}/api/auth/sign-in/social`,
    {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "pathline", callbackURL: "/today" }),
    },
    t.env,
  );
  expect(start.status, await start.clone().text()).toBe(200);
  const jar = cookies(start);
  const { url } = (await start.json()) as { url: string };
  const callback = await app.request(
    idp.authorize(url),
    { headers: { Cookie: header(jar) } },
    t.env,
  );
  cookies(callback, jar);
  return { callback, jar };
}

type Config = {
  services: { pathline: boolean };
  pathlineUrl: string | null;
  pathlineConfigured: boolean;
};
afterEach(() => vi.unstubAllGlobals());

describe("Sign in with Pathline", () => {
  it("signs a verified student in with PKCE and a verified ES256 ID token", async () => {
    const t = environment(),
      idp = await provider();
    vi.stubGlobal("fetch", idp.fetch);
    try {
      const config = (await (
        await app.request(`${ORIGIN}/api/v1/config`, {}, t.env)
      ).json()) as Config;
      expect(config.services.pathline).toBe(true);
      expect(config.pathlineUrl).toBe("https://pathline.example");
      const { callback, jar } = await signIn(t, idp);
      expect(callback.status).toBe(302);
      expect(callback.headers.get("location")).toBe("/today");
      expect(idp.tokenRequests).toHaveLength(1);
      expect(idp.tokenRequests[0].get("client_secret")).toBeNull();
      expect(
        idp.tokenRequests[0].get("code_verifier")?.length,
      ).toBeGreaterThanOrEqual(43);
      const me = await app.request(
        `${ORIGIN}/api/v1/me`,
        { headers: { Cookie: header(jar) } },
        t.env,
      );
      expect(me.status, await me.clone().text()).toBe(200);
      const body = (await me.json()) as {
        user: { email: string; name: string };
        pathline: { linked: boolean; school: string; verified: boolean };
      };
      expect(body.user.email).toBe("student@connect.ust.hk");
      expect(body.user.name).toBe("student");
      expect(body.pathline).toEqual({
        linked: true,
        school: "hkust",
        verified: true,
      });
      // A second sign-in reuses the same account.
      await signIn(t, idp);
      expect(
        (t.db.prepare("SELECT COUNT(*) n FROM user").get() as { n: number }).n,
      ).toBe(1);
    } finally {
      t.close();
    }
  });

  it("refuses an ID token that Pathline's key did not sign", async () => {
    const t = environment(),
      idp = await provider({ forgeSignature: true });
    vi.stubGlobal("fetch", idp.fetch);
    try {
      const { callback, jar } = await signIn(t, idp);
      expect(callback.status).toBe(302);
      expect(callback.headers.get("location")).toContain("error");
      const me = await app.request(
        `${ORIGIN}/api/v1/me`,
        { headers: { Cookie: header(jar) } },
        t.env,
      );
      expect(me.status).toBe(401);
      expect(
        (t.db.prepare("SELECT COUNT(*) n FROM user").get() as { n: number }).n,
      ).toBe(0);
    } finally {
      t.close();
    }
  });

  it("reports Pathline as unavailable until it registers this client", async () => {
    const t = environment(),
      idp = await provider();
    t.env.PATHLINE_CLIENT_ID = "not-registered";
    vi.stubGlobal("fetch", idp.fetch);
    try {
      const config = (await (
        await app.request(`${ORIGIN}/api/v1/config`, {}, t.env)
      ).json()) as Config;
      expect(config.services.pathline).toBe(false);
      expect(config.pathlineConfigured).toBe(true);
    } finally {
      t.close();
    }
  });
});
