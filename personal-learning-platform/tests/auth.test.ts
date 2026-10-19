import { describe, it, expect, vi } from "vitest";
import { app } from "../server/app";
import { testEnvironment } from "./support";
describe("Better Auth integration with local D1 and a simulated mail transport", () => {
  it("issues and verifies a hashed OTP, then authorizes the persisted session", async () => {
    const t = testEnvironment();
    t.env.IDENTITY_MODE = "app";
    t.env.BETTER_AUTH_SECRET =
      "synthetic-auth-test-secret-at-least-32-characters";
    t.env.RESEND_API_KEY = "synthetic-email-key";
    t.env.MAIL_FROM = "Learning <learning@example.test>";
    let delivered = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, options) => {
        delivered = JSON.parse(String(options?.body)).text;
        return new Response(JSON.stringify({ id: "synthetic-email" }), {
          status: 200,
        });
      }),
    );
    const call = (path: string, body: unknown, cookie?: string) =>
      app.request(
        `https://learning.test${path}`,
        {
          method: "POST",
          headers: {
            Origin: "https://learning.test",
            "Content-Type": "application/json",
            ...(cookie ? { Cookie: cookie } : {}),
          },
          body: JSON.stringify(body),
        },
        t.env,
      );
    try {
      const sent = await call("/api/auth/email-otp/send-verification-otp", {
        email: "student@example.test",
        type: "sign-in",
      });
      expect(sent.status, await sent.clone().text()).toBe(200);
      const otp = delivered.match(/\d{6}/)?.[0];
      expect(otp).toBeDefined();
      const row = t.db
        .prepare("SELECT value FROM verification LIMIT 1")
        .get() as { value: string };
      expect(row.value).not.toContain(otp);
      const signed = await call("/api/auth/sign-in/email-otp", {
        email: "student@example.test",
        otp,
      });
      expect(signed.status, await signed.clone().text()).toBe(200);
      const cookies = signed.headers
        .getSetCookie()
        .map((s) => s.split(";")[0])
        .join("; ");
      expect(cookies).toContain("session_token");
      const profile = await app.request(
        "https://learning.test/api/v1/me",
        { headers: { Cookie: cookies } },
        t.env,
      );
      expect(profile.status, await profile.clone().text()).toBe(200);
      expect(
        ((await profile.json()) as { user: { email: string } }).user.email,
      ).toBe("student@example.test");
      const replay = await call("/api/auth/sign-in/email-otp", {
        email: "student@example.test",
        otp,
      });
      expect(replay.status).not.toBe(200);
    } finally {
      vi.unstubAllGlobals();
      t.close();
    }
  });
});
