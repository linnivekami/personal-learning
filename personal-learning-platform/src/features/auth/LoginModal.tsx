import { useState } from "react";
import { LogIn, Mail } from "lucide-react";
import { useI18n } from "../../app/i18n";
import { useLearning } from "../../app/store";
import { post } from "../../lib/api";
import { Modal, Notice, Spinner } from "../../ui/primitives";
import { BrandMark } from "../../ui/Brand";

export function LoginModal() {
  const { tr } = useI18n();
  const L = useLearning();
  const services = L.config?.services ?? {};
  const [email, setEmail] = useState(""),
    [otp, setOtp] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState<string | null>(null);
  const social = async (provider: "pathline" | "google") => {
    setBusy(provider);
    try {
      const back = location.pathname === "/" ? "/" : location.pathname;
      const r = await post<{ url: string }>("/api/auth/sign-in/social", {
        provider,
        callbackURL: back,
        errorCallbackURL: "/?signin=failed",
      });
      if (r.url) location.assign(r.url);
    } catch (e) {
      L.notify(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };
  const emailStep = async () => {
    setBusy("email");
    try {
      if (!sent) {
        await post("/api/auth/email-otp/send-verification-otp", {
          email,
          type: "sign-in",
        });
        setSent(true);
      } else {
        await post("/api/auth/sign-in/email-otp", { email, otp });
        L.closeLogin();
        await L.refresh();
      }
    } catch (e) {
      L.notify(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Modal
      title={tr("登录 Personal Learning", "Sign in to Personal Learning")}
      onClose={L.closeLogin}
    >
      <p className="muted">
        {tr(
          "保存知识框架、学习证据和每一次新的理解。",
          "Keep your knowledge frameworks, learning evidence and every new understanding.",
        )}
      </p>
      {services.pathline ? (
        <button
          className="button full pathline-button"
          disabled={!!busy}
          onClick={() => void social("pathline")}
        >
          {busy === "pathline" ? <Spinner /> : <BrandMark size={20} />}
          {tr("使用 Pathline 账号登录", "Sign in with Pathline")}
        </button>
      ) : (
        L.config?.pathlineConfigured && (
          <Notice>
            {tr(
              "Pathline 账号登录即将开放（等待 Pathline 端启用）。",
              "Sign in with Pathline opens as soon as Pathline enables this site.",
            )}
          </Notice>
        )
      )}
      {(services.pathline || L.config?.pathlineConfigured) && (
        <p className="form-help">
          {tr(
            "需要已验证学校邮箱的 Pathline 账号；同一个身份可以在 Pathline、Agent Arena 和这里通用。",
            "Uses a Pathline account with a confirmed university email — the same identity as Pathline and Agent Arena.",
          )}
        </p>
      )}
      {services.google && (
        <button
          className="button secondary full"
          disabled={!!busy}
          onClick={() => void social("google")}
        >
          {busy === "google" && <Spinner />}
          {tr("使用 Google 继续", "Continue with Google")}
        </button>
      )}
      {services.email && (
        <>
          <div className="divider">
            <span>{tr("或使用邮箱验证码", "or an email code")}</span>
          </div>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void emailStep();
            }}
          >
            <label>
              {tr("邮箱", "Email")}
              <input
                type="email"
                value={email}
                required
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
              />
            </label>
            {sent && (
              <label>
                {tr("6 位验证码", "6-digit code")}
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  required
                />
              </label>
            )}
            <button className="button secondary full" disabled={!!busy}>
              {busy === "email" ? (
                <Spinner />
              ) : sent ? (
                <LogIn size={17} />
              ) : (
                <Mail size={17} />
              )}
              {sent
                ? tr("登录 / 注册", "Sign in / Sign up")
                : tr("发送登录验证码", "Send a sign-in code")}
            </button>
          </form>
        </>
      )}
      {L.config?.identityMode === "sites" && (
        <a
          className="button secondary full"
          href="/signin-with-chatgpt?return_to=/"
          target="_top"
        >
          {tr("使用 ChatGPT 账号继续", "Continue with ChatGPT")}
        </a>
      )}
      {!services.pathline &&
        !services.email &&
        !services.google &&
        L.config?.identityMode !== "sites" && (
          <p className="form-help">
            {tr(
              "当前还没有可用的登录方式。可以先浏览示例课程；管理员开启 Pathline、邮件或 Google 登录后即可保存学习。",
              "No sign-in method is available yet. Explore the sample meanwhile; saving opens once Pathline, email or Google sign-in is enabled.",
            )}
          </p>
        )}
    </Modal>
  );
}
