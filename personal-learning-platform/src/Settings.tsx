import { useState } from "react";
import {
  Bell,
  CheckCircle2,
  Download,
  Upload,
  ShieldCheck,
  LogOut,
  ExternalLink,
  Trash2,
  LoaderCircle,
  Settings,
  MessageSquare,
} from "lucide-react";
import type { AppUser, Usage, ReminderSettings } from "../shared/types";
import { policy } from "../shared/core";
import { api, post } from "./api";
import { Page, Modal, type Configuration } from "./App";
import { download } from "./Pages";
type Tr = (a: string, b: string) => string;
export function SettingsPage({
  config,
  user,
  profile,
  reminders,
  usage,
  language,
  tr,
  onError,
  refresh,
  setReminders,
  onLogin,
  onLogout,
}: {
  config: Configuration | null;
  user: AppUser | null;
  profile: {
    timezone: string;
    name: string;
    preferences: Record<string, unknown>;
  };
  reminders: ReminderSettings;
  usage: Usage | null;
  language: "zh" | "en";
  tr: Tr;
  onError: (s: string) => void;
  refresh: () => Promise<unknown>;
  setReminders: (s: ReminderSettings) => void;
  onLogin: () => void;
  onLogout: () => void;
}) {
  const [settings, setSettings] = useState(reminders),
    [name, setName] = useState(profile.name),
    [timezone, setTimezone] = useState(profile.timezone),
    [busy, setBusy] = useState(false),
    [importData, setImportData] = useState<unknown>(null),
    [preview, setPreview] = useState<{
      conflicts: string[];
      courses: { title: string }[];
      notice: string;
    } | null>(null),
    [feedback, setFeedback] = useState("");
  const save = async () => {
    if (!user) {
      onLogin();
      return;
    }
    setBusy(true);
    try {
      await api("/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: name || user.name,
          timezone,
          language,
          preferences: profile.preferences,
        }),
      });
      await api("/reminders", {
        method: "PUT",
        body: JSON.stringify({ ...settings, timezone }),
      });
      setReminders({ ...settings, timezone });
      await refresh();
      onError(tr("学习设置已保存。", "Learning settings saved."));
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const push = async () => {
    try {
      if (!config?.vapidPublicKey)
        throw new Error(
          tr("管理员尚未配置 Web Push。", "Web Push is not configured."),
        );
      if (!("Notification" in window) || !("PushManager" in window))
        throw new Error(
          tr(
            "此浏览器不支持推送。iPhone 请先添加到主屏幕再打开。",
            "Push is unavailable. On iPhone, add this site to the Home Screen and reopen it.",
          ),
        );
      if ((await Notification.requestPermission()) !== "granted")
        throw new Error(
          tr(
            "通知授权尚未开启。可以继续使用站内提醒或邮件。",
            "Notifications are not enabled. In-app and email reminders remain available.",
          ),
        );
      const registration = await navigator.serviceWorker.ready;
      const key = config.vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/");
      const data = Uint8Array.from(
        atob(key.padEnd(Math.ceil(key.length / 4) * 4, "=")),
        (c) => c.charCodeAt(0),
      );
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: data,
      });
      await post("/push", sub.toJSON());
      setSettings({ ...settings, push: true });
      onError(
        tr(
          "系统通知已开启，保存设置后按计划提醒。",
          "System notifications enabled. Save settings to activate your schedule.",
        ),
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Page
      title={tr("按自己的节奏学习", "Learn at your own pace")}
      subtitle={tr(
        "设置学习时间、提醒方式和数据管理偏好。",
        "Set your learning rhythm, reminders and data preferences.",
      )}
      action={
        user ? (
          <button
            className="button"
            onClick={() => void save()}
            disabled={busy}
          >
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}{" "}
            {tr("保存设置", "Save settings")}
          </button>
        ) : (
          <button className="button" onClick={onLogin}>
            {tr("登录", "Sign in")}
          </button>
        )
      }
    >
      <div className="settings-columns">
        <section className="settings-card">
          <h2>{tr("个人与学习时间", "Profile and schedule")}</h2>
          <label>
            {tr("称呼", "Name")}
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            {tr("所在时区", "Timezone")}
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {[
                "Asia/Singapore",
                "Asia/Hong_Kong",
                "Asia/Shanghai",
                "Asia/Tokyo",
                "Australia/Sydney",
                "Europe/London",
                "America/New_York",
                "America/Los_Angeles",
                "UTC",
              ].map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </label>
          <label className="switch-label">
            <span>
              <strong>{tr("学习提醒", "Learning reminders")}</strong>
              <small>
                {tr(
                  "已经完成今日有效学习时，不重复打扰。",
                  "No repeat reminder after effective learning today.",
                )}
              </small>
            </span>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) =>
                setSettings({ ...settings, enabled: e.target.checked })
              }
            />
          </label>
          <div className="form-grid">
            <label>
              {tr("提醒时间", "Reminder time")}
              <input
                type="time"
                value={settings.time}
                onChange={(e) =>
                  setSettings({ ...settings, time: e.target.value })
                }
              />
            </label>
            <label>
              {tr("每周学习目标", "Days per week")}
              <input
                type="number"
                min="1"
                max="7"
                value={settings.weeklyGoal}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    weeklyGoal: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              {tr("免打扰开始", "Quiet hours start")}
              <input
                type="time"
                value={settings.quietStart}
                onChange={(e) =>
                  setSettings({ ...settings, quietStart: e.target.value })
                }
              />
            </label>
            <label>
              {tr("免打扰结束", "Quiet hours end")}
              <input
                type="time"
                value={settings.quietEnd}
                onChange={(e) =>
                  setSettings({ ...settings, quietEnd: e.target.value })
                }
              />
            </label>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={settings.email}
              onChange={(e) =>
                setSettings({ ...settings, email: e.target.checked })
              }
            />
            {tr(
              "接收邮件提醒（可随时关闭）",
              "Email reminders (turn off anytime)",
            )}
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={settings.push}
              onChange={async (e) => {
                if (e.target.checked) await push();
                else {
                  setSettings({ ...settings, push: false });
                  try {
                    await api("/push", { method: "DELETE" });
                    const reg = await navigator.serviceWorker.ready;
                    await (
                      await reg.pushManager.getSubscription()
                    )?.unsubscribe();
                  } catch (e) {
                    onError(e instanceof Error ? e.message : String(e));
                  }
                }
              }}
            />
            {tr("接收系统推送", "System notifications")}
          </label>
          <p className="form-help">
            {tr(
              "iPhone：分享 → 添加到主屏幕 → 重新打开 → 开启通知。",
              "iPhone: Share → Add to Home Screen → reopen → enable notifications.",
            )}
          </p>
        </section>
        <div>
          <section className="settings-card">
            <h2>{tr("今日可用额度", "Daily allowance")}</h2>
            {[
              [
                tr("生成输入", "Generation input"),
                usage?.inputTokens ?? 0,
                policy.limits.dailyInputTokens,
              ],
              [
                tr("生成输出（含推理）", "Output, including reasoning"),
                usage?.outputTokens ?? 0,
                policy.limits.dailyOutputTokens,
              ],
              [
                tr("语音输入（秒）", "Voice input (seconds)"),
                usage?.asrSeconds ?? 0,
                policy.limits.dailyAsrSeconds,
              ],
              [
                tr("朗读计费字符", "Read-aloud characters"),
                usage?.ttsCharacters ?? 0,
                policy.limits.dailyTtsCharacters,
              ],
            ].map(([label, used, max]) => (
              <div className="usage-row" key={label}>
                <div>
                  <span>{label}</span>
                  <small>
                    {Number(used).toLocaleString()} /{" "}
                    {Number(max).toLocaleString()}
                  </small>
                </div>
                <div className="usage-bar">
                  <i
                    style={{
                      width: `${Math.min(100, (Number(used) / Number(max)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            <p className="form-help">
              {tr(
                "额度耗尽后，已有资料、笔记和浏览器内代码练习仍可使用。",
                "Saved materials, notes and browser code practice stay available after generation limits are reached.",
              )}
            </p>
          </section>
          <section className="settings-card">
            <h2>{tr("服务连接状态", "Service connections")}</h2>
            {Object.entries(config?.services ?? {}).map(([id, ready]) => (
              <div className="service-row" key={id}>
                <span>
                  {(
                    {
                      model: tr("DeepSeek 教学", "DeepSeek teaching"),
                      voice: tr("语音识别与朗读", "Voice messages"),
                      email: tr("邮件", "Email"),
                      google: "Google",
                      auth: tr("账号认证", "Authentication"),
                      converter: tr("文档转换", "Document conversion"),
                      push: "Web Push",
                      sandbox: tr("独立代码运行区", "Isolated code runtime"),
                    } as Record<string, string>
                  )[id] ?? id}
                </span>
                <span className={ready ? "service-ready" : "muted"}>
                  {ready
                    ? tr("已配置", "Configured")
                    : tr("待配置", "Not configured")}
                </span>
              </div>
            ))}
            <p className="form-help">
              {tr(
                "管理员在项目目录运行 npm run configure，安全填写服务配置。密钥不会显示在此页面。",
                "Administrators can run npm run configure in the project to configure services securely.",
              )}
            </p>
          </section>
        </div>
      </div>
      <section className="settings-card">
        <h2>
          {tr("你的资料与学习记录", "Your materials and learning records")}
        </h2>
        <p>
          {tr(
            "导出完整学习记录。导入前检查冲突，历史等级和证据来源保留。",
            "Export learning records, preview import conflicts and preserve historical evidence.",
          )}
        </p>
        <div className="button-row">
          <a
            className="button secondary"
            href="/api/v1/export/archive"
            download
          >
            <Download size={16} />
            {tr("下载含附件的完整归档", "Download archive with files")}
          </a>
          <button
            className="button secondary"
            disabled={!user}
            onClick={async () => {
              try {
                const d = await api("/export");
                download(
                  "personal-learning-export.json",
                  JSON.stringify(d, null, 2),
                );
              } catch (e) {
                onError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            <Download size={16} />
            {tr("导出我的数据", "Export my data")}
          </button>
          <label className="button secondary">
            <Upload size={16} />
            {tr("导入学习记录", "Import records")}
            <input
              hidden
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 20 * 1024 * 1024) {
                  onError(
                    tr(
                      "导入文件不能超过 20MB。",
                      "Import file must be under 20MB.",
                    ),
                  );
                  return;
                }
                try {
                  const data = JSON.parse(await f.text());
                  const r = await post<NonNullable<typeof preview>>(
                    "/import/preview",
                    data,
                  );
                  setImportData(data);
                  setPreview(r);
                } catch (e) {
                  onError(e instanceof Error ? e.message : String(e));
                }
              }}
            />
          </label>
        </div>
      </section>
      <section className="settings-card">
        <h2>
          {tr("告诉我们哪里可以更好", "Help improve your learning experience")}
        </h2>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          placeholder={tr(
            "讲解、题目、知识框架或软件问题…",
            "Teaching, practice, framework or software feedback…",
          )}
        />
        <button
          className="button secondary small"
          disabled={!user || feedback.trim().length < 5}
          onClick={async () => {
            try {
              await post("/feedback", { body: feedback });
              setFeedback("");
              onError(
                tr(
                  "反馈已保存到管理控制台。",
                  "Feedback saved for the administrator.",
                ),
              );
            } catch (e) {
              onError(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          <MessageSquare size={16} />
          {tr("提交反馈", "Send feedback")}
        </button>
      </section>
      {user && (
        <div className="account-actions">
          <button
            className="text-button"
            onClick={async () => {
              try {
                if (config?.identityMode === "sites") {
                  location.assign("/signout-with-chatgpt?return_to=/");
                  return;
                }
                await post("/api/auth/sign-out", {});
                onLogout();
              } catch (e) {
                onError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            <LogOut size={16} />
            {tr("退出登录", "Sign out")}
          </button>
          <button
            className="text-button danger"
            onClick={async () => {
              const answer = prompt(
                tr(
                  "这会删除账号及个人资料。输入 DELETE 确认。",
                  "This deletes your account and personal data. Type DELETE to confirm.",
                ),
              );
              if (answer !== "DELETE") return;
              try {
                await api("/me", {
                  method: "DELETE",
                  body: JSON.stringify({ confirm: "DELETE" }),
                });
                onLogout();
              } catch (e) {
                onError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            <Trash2 size={16} />
            {tr("删除我的账号与资料", "Delete account and data")}
          </button>
        </div>
      )}
      {preview && (
        <Modal
          title={tr("检查导入内容", "Review the import")}
          onClose={() => setPreview(null)}
        >
          <p>{preview.notice}</p>
          <ul>
            {preview.courses.map((c, i) => (
              <li key={i}>{c.title}</li>
            ))}
          </ul>
          {preview.conflicts.length > 0 ? (
            <p className="danger">
              {tr("需要先处理的冲突：", "Resolve these conflicts first: ")}
              {preview.conflicts.join(", ")}
            </p>
          ) : (
            <p>
              {tr("未发现编号或名称冲突。", "No ID or title conflicts found.")}
            </p>
          )}
          <button
            className="button"
            disabled={!!preview.conflicts.length || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await post("/import", { data: importData, confirm: true });
                await refresh();
                setPreview(null);
                onError(tr("导入完成。", "Import complete."));
              } catch (e) {
                onError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {tr("确认导入", "Confirm import")}
          </button>
        </Modal>
      )}
    </Page>
  );
}
