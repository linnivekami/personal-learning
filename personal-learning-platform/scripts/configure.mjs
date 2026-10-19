import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { stdin, stdout } from "node:process";
import { writeFile, readFile } from "node:fs/promises";
import { randomBytes, createECDH } from "node:crypto";
let muted = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({ input: stdin, output, terminal: !!stdin.isTTY });
const values = {};
try {
  for (const line of (await readFile(".dev.vars", "utf8")).split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m)
      try {
        values[m[1]] = JSON.parse(m[2]);
      } catch {
        values[m[1]] = m[2];
      }
  }
} catch {}
values.APP_ENV = "production";
values.IDENTITY_MODE = "app";
delete values.DEV_AUTH;
if (
  !values.BETTER_AUTH_SECRET ||
  values.BETTER_AUTH_SECRET.startsWith("local-development-only")
)
  values.BETTER_AUTH_SECRET = randomBytes(48).toString("base64url");
console.log(
  "Personal Learning 安全配置。留空保留现值；不回显密钥；仅写入被 Git 忽略的 .dev.vars。",
);
async function ask(key, label, secret = false) {
  stdout.write(
    `${label}${values[key] ? "（已配置，留空保留）" : "（可稍后配置）"}: `,
  );
  muted = secret;
  let answer;
  try {
    answer = await rl.question("");
  } finally {
    muted = false;
    if (secret) stdout.write("\n");
  }
  if (answer.trim()) values[key] = answer.trim();
}
await ask("APP_ORIGIN", "正式网站 HTTPS 地址");
await ask("ADMIN_EMAILS", "管理员邮箱");
await ask("SANDBOX_ORIGIN", "独立无登录态运行区 HTTPS 地址");
await ask("DEEPSEEK_API_KEY", "DeepSeek API Key", true);
await ask("DASHSCOPE_API_KEY", "阿里云新加坡 API Key", true);
await ask(
  "DASHSCOPE_BASE_URL",
  "阿里云新加坡兼容 API 基础地址（含 /compatible-mode/v1）",
);
await ask("RESEND_API_KEY", "Resend API Key", true);
await ask("MAIL_FROM", "已验证发件地址");
await ask("GOOGLE_CLIENT_ID", "Google OAuth Client ID");
await ask("GOOGLE_CLIENT_SECRET", "Google OAuth Client Secret", true);
await ask("CONVERTER_URL", "Cloud Run 转换服务 HTTPS 地址");
await ask("CONVERTER_TOKEN", "转换服务共享密钥", true);
if (!values.VAPID_PUBLIC_KEY || !values.VAPID_PRIVATE_KEY) {
  const v = createECDH("prime256v1");
  v.generateKeys();
  values.VAPID_PUBLIC_KEY = v.getPublicKey().toString("base64url");
  values.VAPID_PRIVATE_KEY = v.getPrivateKey().toString("base64url");
}
values.VAPID_SUBJECT = `mailto:${(values.ADMIN_EMAILS ?? "admin@example.com").split(",")[0]}`;
for (const key of ["APP_ORIGIN", "SANDBOX_ORIGIN", "CONVERTER_URL"])
  if (values[key] && new URL(values[key]).protocol !== "https:")
    throw new Error(`${key} must use HTTPS`);
await writeFile(
  ".dev.vars",
  Object.entries(values)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
rl.close();
console.log(
  "配置已安全保存。认证及推送密钥保持稳定；按 docs/DEPLOYMENT.md 部署。",
);
