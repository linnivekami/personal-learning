import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { Page } from "../../ui/primitives";
import policy from "../../../shared/policy.json";
import { api, post } from "../../lib/api";
type Tr = (a: string, b: string) => string;
export function AdminPage({
  tr,
  onError,
}: {
  tr: Tr;
  onError: (s: string) => void;
}) {
  const [data, setData] = useState<{
      budgets: Record<string, unknown>[];
      users: Record<string, string>[];
      jobs: Record<string, unknown>[];
      feedback: Record<string, string>[];
      settings: { key: string; value: string }[];
      audit: Record<string, string>[];
    } | null>(null),
    [tab, setTab] = useState("budget");
  const load = () =>
    api<NonNullable<typeof data>>("/admin/overview")
      .then(setData)
      .catch((e) => onError(e.message));
  useEffect(() => {
    void load();
  }, []);
  if (!data)
    return (
      <Page
        title={tr("管理控制台", "Admin console")}
        lead={tr("正在读取平台运行状态…", "Loading operational status…")}
      >
        <LoaderCircle className="spin" />
      </Page>
    );
  return (
    <Page
      title={tr("管理控制台", "Admin console")}
      lead={tr(
        "预算、后台任务、用户反馈与数据恢复。",
        "Budgets, background tasks, feedback and recovery.",
      )}
      action={
        <button className="button secondary" onClick={() => void load()}>
          <RefreshCw size={16} />
          {tr("刷新", "Refresh")}
        </button>
      }
    >
      <div className="segmented">
        {[
          ["budget", "预算", "Budget"],
          ["users", "用户", "Users"],
          ["jobs", "任务", "Jobs"],
          ["feedback", "反馈", "Feedback"],
          ["backup", "备份", "Backup"],
        ].map(([id, zh, en]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {tr(zh, en)}
          </button>
        ))}
      </div>
      {tab === "budget" && (
        <>
          <div className="budget-summary">
            <h2>
              ¥300 <small>/ {tr("月", "month")}</small>
            </h2>
            <p>
              {tr(
                "模型 ¥130 · 语音 ¥60 · 基础设施 ¥70 · 余量 ¥40",
                "Model ¥130 · Voice ¥60 · Infrastructure ¥70 · Reserve ¥40",
              )}
            </p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                {[
                  tr("月份", "Month"),
                  tr("预算池", "Pool"),
                  tr("已结算", "Spent"),
                  tr("预占", "Reserved"),
                  tr("额度", "Limit"),
                ].map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.budgets.map((b, i) => (
                <tr key={i}>
                  <td>{String(b.month)}</td>
                  <td>{String(b.bucket)}</td>
                  <td>¥{(Number(b.spent) / 100).toFixed(2)}</td>
                  <td>¥{(Number(b.reserved) / 100).toFixed(2)}</td>
                  <td>¥{(Number(b.limit_fen) / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <QuotaEditor
            settings={data.settings}
            onDone={load}
            onError={onError}
            tr={tr}
          />
        </>
      )}
      {tab === "users" && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{tr("姓名", "Name")}</th>
              <th>{tr("邮箱", "Email")}</th>
              <th>{tr("注册时间", "Created")}</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.user_id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tab === "jobs" && (
        <div className="job-list">
          {data.jobs.map((j) => (
            <div key={String(j.id)}>
              <strong>{String(j.kind)}</strong>
              <span className="soft-tag">{String(j.status)}</span>
              <small>
                {tr("尝试次数", "Attempts")}: {String(j.attempts)}
              </small>
              {!!j.error && <p>{String(j.error)}</p>}
              {j.status === "failed" && (
                <button
                  className="button secondary small"
                  onClick={async () => {
                    try {
                      await post(`/admin/jobs/${j.id}/retry`, {});
                      await load();
                    } catch (e) {
                      onError(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  {tr("重试", "Retry")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {tab === "feedback" && (
        <div className="job-list">
          {data.feedback.map((f) => (
            <div key={f.id}>
              <strong>{f.status}</strong>
              <p>{f.body}</p>
              {f.status === "open" && (
                <button
                  className="text-button"
                  onClick={async () => {
                    await api(`/admin/feedback/${f.id}`, { method: "PATCH" });
                    await load();
                  }}
                >
                  {tr("标记已处理", "Mark resolved")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {tab === "backup" && (
        <div className="settings-card">
          <ShieldCheck size={28} />
          <h2>{tr("加密数据备份", "Encrypted data backup")}</h2>
          <p>
            {tr(
              "备份按表分页写入私有 R2，并使用认证密钥派生的独立 AES-GCM 密钥加密。恢复步骤和密钥轮换要求见维护说明。",
              "Backups are paginated into private R2 and encrypted with AES-GCM. Recovery and key rotation are documented in the operations guide.",
            )}
          </p>
          <button
            className="button"
            onClick={async () => {
              try {
                const d = await post<{ jobId: string }>("/admin/backup", {});
                onError(`${tr("备份已排队", "Backup queued")}: ${d.jobId}`);
                await load();
              } catch (e) {
                onError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            {tr("创建备份", "Create backup")}
          </button>
          <h3>{tr("审计记录", "Audit trail")}</h3>
          {data.audit.map((a) => (
            <p key={a.id}>
              {a.created_at} · {a.action}
            </p>
          ))}
        </div>
      )}
    </Page>
  );
}
function QuotaEditor({
  onDone,
  onError,
  tr,
  settings,
}: {
  onDone: () => Promise<unknown>;
  onError: (s: string) => void;
  tr: Tr;
  settings: { key: string; value: string }[];
}) {
  const [kind, setKind] = useState<"quota" | "budget">("quota"),
    [values, setValues] = useState<Record<string, number>>({});
  useEffect(() => {
    const defaults = kind === "quota" ? policy.limits : policy.budget;
    const saved = settings.find((s) => s.key === kind);
    setValues({ ...defaults, ...(saved ? JSON.parse(saved.value) : {}) });
  }, [kind, settings]);
  const labels: Record<string, [string, string]> = {
    dailyInputTokens: ["每日输入 tokens", "Daily input tokens"],
    dailyOutputTokens: [
      "每日输出 tokens（含推理）",
      "Daily output tokens (including reasoning)",
    ],
    dailyAsrSeconds: ["每日识别秒数", "Daily ASR seconds"],
    dailyTtsCharacters: ["每日朗读计费字符", "Daily TTS billable characters"],
    monthlyMaterialPages: ["每月资料页数", "Monthly material pages"],
    fileBytes: ["单文件字节上限", "File bytes"],
    filePages: ["单文件页数上限", "File pages"],
    storageBytes: ["个人存储字节", "Personal storage bytes"],
    globalStorageBytes: ["全站存储字节", "Site storage bytes"],
    totalFen: ["月总预算（分）", "Monthly total (fen)"],
    infrastructureFen: ["基础设施（分）", "Infrastructure (fen)"],
    modelFen: ["教学与搜索（分）", "Teaching and search (fen)"],
    voiceFen: ["语音（分）", "Voice (fen)"],
    reserveFen: ["余量（分）", "Reserve (fen)"],
  };
  return (
    <form
      className="settings-card"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api("/admin/settings", {
            method: "PUT",
            body: JSON.stringify({ key: kind, value: values }),
          });
          await onDone();
          onError(tr("设置已保存并记录审计。", "Settings saved and audited."));
        } catch (e) {
          onError(e instanceof Error ? e.message : String(e));
        }
      }}
    >
      <h3>{tr("额度与预算配置", "Quota and budget configuration")}</h3>
      <select
        aria-label={tr("配置类型", "Setting type")}
        value={kind}
        onChange={(e) => setKind(e.target.value as typeof kind)}
      >
        <option value="quota">
          {tr("个人及存储额度", "Personal and storage quotas")}
        </option>
        <option value="budget">
          {tr("全站月预算", "Site monthly budget")}
        </option>
      </select>
      <div className="form-grid">
        {Object.entries(values).map(([key, value]) => (
          <label key={key}>
            {tr(...(labels[key] ?? [key, key]))}
            <input
              type="number"
              min={0}
              step={1}
              value={value}
              onChange={(e) =>
                setValues({ ...values, [key]: Number(e.target.value) })
              }
            />
          </label>
        ))}
      </div>
      <button className="button secondary small">
        {tr("保存设置", "Save settings")}
      </button>
    </form>
  );
}
