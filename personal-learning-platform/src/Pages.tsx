import { useEffect, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Link2,
  LoaderCircle,
  Plus,
  ExternalLink,
  RefreshCw,
  Trash2,
  NotebookPen,
  Save,
  Check,
  Trophy,
  Flame,
  Star,
  Coins,
  ShieldCheck,
  CalendarDays,
  Download,
  ArrowRight,
  Code2,
} from "lucide-react";
import type {
  AppUser,
  Course,
  Material,
  Note,
  RewardState,
} from "../shared/types";
import { Page, Empty, Modal } from "./App";
import { RichText } from "./RichText";
import { CodeRunner } from "./CodeRunner";
import policy from "../shared/policy.json";
import { api, post } from "./api";
type Tr = (a: string, b: string) => string;
export function MaterialsPage({
  course,
  materials,
  setMaterials,
  requireLogin,
  onError,
  onOrganized,
  tr,
}: {
  course: Course;
  materials: Material[];
  setMaterials: (v: Material[]) => void;
  requireLogin: () => boolean;
  onError: (s: string) => void;
  onOrganized: (c: Course) => void;
  tr: Tr;
}) {
  const [uploading, setUploading] = useState(false),
    [dragging, setDragging] = useState(false),
    [url, setUrl] = useState(""),
    [query, setQuery] = useState(""),
    [searchResults, setSearchResults] = useState<
      { title: string; url: string; snippet: string; sourceId: string | null }[]
    >([]),
    [busy, setBusy] = useState(false);
  const upload = async (files: File[]) => {
    if (!requireLogin()) return;
    setUploading(true);
    try {
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const r = await api<{ material: Material }>(
          `/courses/${course.id}/materials`,
          { method: "POST", body: form },
        );
        setMaterials([r.material, ...materials]);
      }
      const d = await api<{ materials: Material[] }>(
        `/courses/${course.id}/materials`,
      );
      setMaterials(d.materials);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };
  const states: Record<string, [string, string]> = {
    uploaded: ["等待解析", "Queued"],
    processing: ["解析中", "Processing"],
    ready: ["已就绪", "Ready"],
    partial: ["部分解析 / 待核对", "Partial / check source"],
    failed: ["解析失败", "Failed"],
  };
  return (
    <Page
      title={tr(
        "把你的资料，连成知识",
        "Turn your materials into connected knowledge",
      )}
      subtitle={`${course.title} · ${tr("保留原文与页码，让每次讲解有处可查。", "Keep original files and page references behind every explanation.")}`}
      action={
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            if (!requireLogin()) return;
            setBusy(true);
            try {
              const r = await post<{ course: Course }>(
                `/courses/${course.id}/organize`,
                {},
              );
              onOrganized(r.course);
              onError(
                tr(
                  "资料已整理到知识框架。",
                  "Materials organized into your knowledge framework.",
                ),
              );
            } catch (e) {
              onError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Plus size={17} />
          )}{" "}
          {tr("整理到知识框架", "Organize into framework")}
        </button>
      }
    >
      <div
        className={`upload-zone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload([...e.dataTransfer.files]);
        }}
      >
        <Upload size={30} strokeWidth={1.4} />
        <h3>
          {tr(
            "把课件、教材或笔记放在这里",
            "Bring your slides, readings and notes here",
          )}
        </h3>
        <p>PDF · PPTX · DOCX · PNG / JPG · TXT / MD / CSV</p>
        <label className="button secondary">
          {uploading ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Plus size={16} />
          )}{" "}
          {tr("选择文件", "Choose files")}
          <input
            type="file"
            hidden
            multiple
            accept=".pdf,.pptx,.docx,.png,.jpg,.jpeg,.webp,.txt,.md,.csv"
            disabled={uploading}
            onChange={(e) => void upload([...(e.target.files ?? [])])}
          />
        </label>
        <small>
          {tr(
            "单文件不超过 20MB、100 页；每月 200 页",
            "Up to 20MB / 100 pages per file; 200 pages per month",
          )}
        </small>
      </div>
      <form
        className="web-import"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!requireLogin()) return;
          setBusy(true);
          try {
            await post(`/courses/${course.id}/web`, { url });
            setUrl("");
            onError(
              tr(
                "网页正文已保存，接下来可以整理到框架。",
                "Web page saved. You can now organize it into the framework.",
              ),
            );
          } catch (e) {
            onError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Link2 size={19} />
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={tr(
            "或粘贴一个公开网页的 HTTPS 链接",
            "Or paste a public HTTPS page URL",
          )}
        />
        <button className="button secondary small" disabled={busy}>
          {tr("导入网页", "Import page")}
        </button>
      </form>
      <form
        className="web-import"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!requireLogin()) return;
          setBusy(true);
          try {
            const d = await post<{ results: typeof searchResults }>(
              `/courses/${course.id}/search`,
              { query },
            );
            setSearchResults(d.results);
          } catch (e) {
            onError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Link2 size={19} />
        <input
          aria-label={tr("搜索公开资料", "Search public sources")}
          maxLength={128}
          required
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr(
            "搜索公开教材、文档或课程资料",
            "Search public textbooks, documentation or course sources",
          )}
        />
        <button className="button secondary small" disabled={busy}>
          {tr("搜索", "Search")}
        </button>
      </form>
      {searchResults.map((r) => (
        <div key={r.url} className="surface-card">
          <a href={r.url} target="_blank" rel="noreferrer">
            {r.title} ↗
          </a>
          <p>{r.snippet}</p>
          <small>
            {r.sourceId
              ? tr("已取得正文并保存来源", "Page content retrieved and saved")
              : tr(
                  "仅检索摘要；导入网页后可作为正文来源",
                  "Search summary only; import the page to use its full text",
                )}
          </small>
          {!r.sourceId && (
            <button className="text-button" onClick={() => setUrl(r.url)}>
              {tr("填入导入链接", "Use this URL")}
            </button>
          )}
        </div>
      ))}
      <h2 className="section-title">
        {tr("课程资料", "Course materials")} <span>{materials.length}</span>
      </h2>
      {materials.length ? (
        <div className="material-list">
          {materials.map((m) => (
            <div className="material-row" key={m.id}>
              <span className="file-icon">
                <FileText size={23} />
              </span>
              <div className="material-info">
                <strong>{m.name}</strong>
                <small>
                  {(m.bytes / 1024 / 1024).toFixed(2)} MB · {m.pages || "—"}{" "}
                  {tr("页", "pages")} · {tr(...states[m.status])}
                </small>
                {m.error && <p className="material-error">{m.error}</p>}
              </div>
              <a
                className="icon-button"
                href={`/api/v1/materials/${m.id}/file`}
                target="_blank"
                rel="noreferrer"
                title={tr("原始资料", "Open original")}
              >
                <ExternalLink size={17} />
              </a>
              {["failed", "partial"].includes(m.status) && (
                <button
                  className="icon-button"
                  title={tr("重新解析", "Retry parsing")}
                  onClick={async () => {
                    try {
                      await post(`/materials/${m.id}/retry`, {});
                      setMaterials(
                        materials.map((x) =>
                          x.id === m.id
                            ? { ...x, status: "uploaded", error: null }
                            : x,
                        ),
                      );
                    } catch (e) {
                      onError(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  <RefreshCw size={17} />
                </button>
              )}
              <button
                className="icon-button danger"
                title={tr("删除资料", "Delete material")}
                onClick={async () => {
                  if (
                    !confirm(
                      tr(
                        "删除这份资料及其解析来源？已保存笔记不会被删除。",
                        "Delete this material and extracted sources? Saved notes will remain.",
                      ),
                    )
                  )
                    return;
                  try {
                    await api(`/materials/${m.id}`, { method: "DELETE" });
                    setMaterials(materials.filter((x) => x.id !== m.id));
                  } catch (e) {
                    onError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          icon={FileText}
          title={tr(
            "第一份资料，会成为框架的起点",
            "Your first source becomes a starting point",
          )}
          text={tr(
            "也可以不上传资料，直接围绕想学的主题开始。",
            "You can also start directly from a topic you want to learn.",
          )}
        />
      )}
    </Page>
  );
}
export function NotesPage({
  course,
  notes,
  setNotes,
  requireLogin,
  onError,
  tr,
}: {
  course: Course;
  notes: Note[];
  setNotes: (n: Note[]) => void;
  requireLogin: () => boolean;
  onError: (s: string) => void;
  tr: Tr;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [concept, setConcept] = useState(""),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const open = (n: Note) => {
    if (
      dirty &&
      !confirm(
        tr(
          "切换笔记前放弃当前未保存的修改？",
          "Discard unsaved changes before switching notes?",
        ),
      )
    )
      return;
    setSelected(n.id);
    setTitle(n.title);
    setBody(n.body);
    setConcept(n.conceptId ?? "");
    setDirty(false);
  };
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);
  const save = async () => {
    if (!requireLogin()) return;
    if (!title.trim()) {
      onError(tr("先给笔记一个标题。", "Give your note a title."));
      return;
    }
    setBusy(true);
    try {
      const payload = { title, body, conceptId: concept || null };
      let id = selected;
      if (id)
        await api(`/notes/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      else
        id = (
          await post<{ id: string }>(`/courses/${course.id}/notes`, payload)
        ).id;
      setSelected(id);
      const r = await api<{ notes: Note[] }>(`/courses/${course.id}/notes`);
      setNotes(r.notes);
      setDirty(false);
      onError(tr("笔记已保存。", "Note saved."));
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title={tr("把理解留下来", "Keep what you have understood")}
      subtitle={tr(
        "把解释写成自己的话，再放回知识框架。",
        "Write it in your own words and reconnect it to the framework.",
      )}
      action={
        <button
          className="button"
          onClick={() => {
            if (!requireLogin()) return;
            setSelected(null);
            setTitle("");
            setBody("");
            setConcept("");
            setDirty(false);
          }}
        >
          <Plus size={16} />
          {tr("新建笔记", "New note")}
        </button>
      }
    >
      <div className="notes-layout">
        <aside className="notes-list">
          {notes.map((n) => (
            <button
              key={n.id}
              className={selected === n.id ? "active" : ""}
              onClick={() => open(n)}
            >
              <NotebookPen size={17} />
              <div>
                <strong>{n.title}</strong>
                <small>{new Date(n.updatedAt).toLocaleDateString()}</small>
              </div>
            </button>
          ))}
          {!notes.length && (
            <p className="muted">
              {tr(
                "你的总结、洞察与问题会收集在这里。",
                "Your summaries, insights and questions live here.",
              )}
            </p>
          )}
        </aside>
        <div className="note-editor">
          <input
            className="note-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            placeholder={tr("给这次理解起个名字", "Name this understanding")}
          />
          <div className="note-toolbar">
            <select
              aria-label={tr("关联知识点", "Link to concept")}
              value={concept}
              onChange={(e) => {
                setConcept(e.target.value);
                setDirty(true);
              }}
            >
              <option value="">
                {tr("关联一个知识点（可选）", "Link a concept (optional)")}
              </option>
              {course.concepts.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
            <button
              className="text-button"
              onClick={() => setPreview(!preview)}
            >
              {preview ? tr("编辑", "Edit") : tr("预览", "Preview")}
            </button>
          </div>
          {preview ? (
            <div className="note-preview">
              <RichText text={body} />
            </div>
          ) : (
            <textarea
              className="note-body"
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setDirty(true);
              }}
              placeholder={tr(
                "这个概念解决什么问题？它与前面的知识怎样相连？我还有哪里不确定？\n\n支持 Markdown 与 $公式$。",
                "What problem does this concept solve? How does it connect? What am I still unsure about?\n\nMarkdown and $formulas$ are supported.",
              )}
            />
          )}
          <div className="note-footer">
            <button
              className="button"
              disabled={busy || !title.trim()}
              onClick={() => void save()}
            >
              {busy ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <Save size={15} />
              )}{" "}
              {tr("保存笔记", "Save note")}
              {dirty ? " *" : ""}
            </button>
            {selected && (
              <button
                className="text-button"
                disabled={busy || dirty}
                onClick={async () => {
                  try {
                    await post(`/notes/${selected}/reflect`, {});
                    onError(
                      tr(
                        "自主总结已记为有效学习，不自动增加掌握度。",
                        "Reflection recorded as effective learning; mastery is assessed separately.",
                      ),
                    );
                  } catch (e) {
                    onError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                {tr("记录一次自主总结", "Record a reflection")}
              </button>
            )}
            <button
              className="icon-button"
              title={tr("导出 Markdown", "Export Markdown")}
              onClick={() =>
                download(
                  `${title || "note"}.md`,
                  `# ${title}\n\n${body}`,
                  "text/markdown",
                )
              }
            >
              <Download size={17} />
            </button>
            {selected && (
              <button
                className="icon-button danger"
                title={tr("删除笔记", "Delete note")}
                onClick={async () => {
                  if (!confirm(tr("删除这篇笔记？", "Delete this note?")))
                    return;
                  try {
                    await api(`/notes/${selected}`, { method: "DELETE" });
                    setNotes(notes.filter((n) => n.id !== selected));
                    setSelected(null);
                    setBody("");
                    setTitle("");
                  } catch (e) {
                    onError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                <Trash2 size={17} />
              </button>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
export function GrowthPage({
  rewards,
  refresh,
  onError,
  tr,
  user,
}: {
  rewards: RewardState | null;
  refresh: () => Promise<unknown>;
  onError: (s: string) => void;
  tr: Tr;
  user: AppUser | null;
}) {
  const r = rewards ?? {
    xp: 0,
    level: 1,
    coins: 0,
    streak: 0,
    effectiveDays: [],
    badges: [],
    owned: ["forest", "seed"],
    equippedTheme: "forest",
    equippedAvatar: "seed",
  };
  const today = new Date();
  const days = Array.from({ length: 35 }, (_, i) =>
    new Date(
      Date.UTC(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - (34 - i),
      ),
    )
      .toISOString()
      .slice(0, 10),
  );
  const shop = [
    {
      id: "ocean",
      name: tr("海洋主题", "Ocean theme"),
      price: 40,
      icon: "🌊",
      type: "theme",
    },
    {
      id: "plum",
      name: tr("暮紫主题", "Plum theme"),
      price: 60,
      icon: "🌙",
      type: "theme",
    },
    {
      id: "amber",
      name: tr("琥珀主题", "Amber theme"),
      price: 80,
      icon: "☀️",
      type: "theme",
    },
    {
      id: "fox",
      name: tr("小狐狸头像", "Fox avatar"),
      price: 30,
      icon: "🦊",
      type: "avatar",
    },
    {
      id: "owl",
      name: tr("猫头鹰头像", "Owl avatar"),
      price: 60,
      icon: "🦉",
      type: "avatar",
    },
    {
      id: "planet",
      name: tr("探索者头像", "Explorer avatar"),
      price: 100,
      icon: "🪐",
      type: "avatar",
    },
  ];
  const badges = [
    ["first-step", "🌱", tr("迈出第一步", "First step")],
    ["seven-days", "🌿", tr("七次生长", "Seven growing days")],
    ["remember", "🧠", tr("记得住的理解", "Understanding that stays")],
    ["connector", "🔗", tr("跨域连接者", "Knowledge connector")],
    ["independent", "⭐", tr("独立思考者", "Independent thinker")],
  ];
  return (
    <Page
      title={tr("看见自己的生长", "See your own growth")}
      subtitle={tr(
        "奖励每一次真实投入，掌握度仍由学习证据决定。",
        "Celebrate real effort. Mastery still follows the evidence.",
      )}
    >
      <section className="growth-hero">
        <div className="growth-plant">
          {r.equippedAvatar === "fox"
            ? "🦊"
            : r.equippedAvatar === "owl"
              ? "🦉"
              : r.equippedAvatar === "planet"
                ? "🪐"
                : "🌿"}
        </div>
        <div>
          <span>
            {tr("学习者等级", "Learner level")} {r.level}
          </span>
          <h2>
            {r.xp === 0
              ? tr("每一个新连接，都是成长", "Every connection is growth")
              : tr("理解，正在扎下根", "Understanding is taking root")}
          </h2>
          <div className="xp-track">
            <i style={{ width: `${((r.xp % 150) / 150) * 100}%` }} />
          </div>
          <small>
            {r.xp % 150} / 150 XP · {tr("距离下一级", "toward your next level")}
          </small>
        </div>
        <div className="growth-numbers">
          <span>
            <Flame size={20} />
            <b>{r.streak}</b>
            {tr("连续学习", "day streak")}
          </span>
          <span>
            <Coins size={20} />
            <b>{r.coins}</b>
            {tr("学习币", "learning coins")}
          </span>
        </div>
      </section>
      <div className="growth-two">
        <section className="calendar-panel">
          <h2>{tr("你的学习足迹", "Your learning footprint")}</h2>
          <div className="learning-calendar">
            {days.map((day) => (
              <span
                key={day}
                className={r.effectiveDays.includes(day) ? "effective" : ""}
                title={`${day}${r.effectiveDays.includes(day) ? " ✓" : ""}`}
              >
                {Number(day.slice(-2))}
              </span>
            ))}
          </div>
          <p>
            {tr(
              "完成作答、复习或自主总结，会点亮这一天。断签后，随时继续。",
              "An attempt, review or reflection lights up a day. You can always resume after a break.",
            )}
          </p>
        </section>
        <section className="challenge-panel">
          <h2>{tr("小挑战，真进步", "Small challenges, real progress")}</h2>
          <div>
            <Check size={17} />
            <p>
              <strong>
                {tr(
                  "今日：独立尝试一道题",
                  "Today: attempt a task independently",
                )}
              </strong>
              <small>
                {tr(
                  r.challenges?.dailyComplete
                    ? "已完成 · 额外 15 XP / 5 学习币已入账"
                    : "完成作答或自主总结 · 额外 15 XP / 5 学习币",
                  r.challenges?.dailyComplete
                    ? "Completed · bonus 15 XP / 5 coins awarded"
                    : "Attempt or reflect · bonus 15 XP / 5 coins",
                )}
              </small>
            </p>
          </div>
          <div>
            <CalendarDays size={17} />
            <p>
              <strong>
                {tr(
                  `本周：让学习发生 ${r.challenges?.weeklyGoal ?? 5} 天`,
                  `This week: learn on ${r.challenges?.weeklyGoal ?? 5} days`,
                )}
              </strong>
              <small>
                {r.challenges?.weeklyProgress ?? 0} /{" "}
                {r.challenges?.weeklyGoal ?? 5}{" "}
                {tr("天已记录", "days recorded")}
              </small>
            </p>
          </div>
          <div>
            <Star size={17} />
            <p>
              <strong>
                {tr(
                  "连接挑战：完成一次迁移练习",
                  "Connect: complete a transfer task",
                )}
              </strong>
              <small>
                {tr(
                  "用不同情境检验同一个核心关系",
                  "Test the same principle in a new context",
                )}
              </small>
            </p>
          </div>
        </section>
      </div>
      <h2 className="section-title">{tr("成长徽章", "Milestones")}</h2>
      <div className="badge-grid">
        {badges.map(([id, icon, name]) => (
          <div
            key={id}
            className={`badge-card ${r.badges.includes(id) ? "earned" : ""}`}
          >
            <span>{icon}</span>
            <strong>{name}</strong>
            <small>
              {r.badges.includes(id)
                ? tr("已点亮", "Earned")
                : tr("等待下一次成长", "A milestone ahead")}
            </small>
          </div>
        ))}
      </div>
      <h2 className="section-title">
        {tr("给学习空间一点个性", "Make the workspace yours")}
      </h2>
      <div className="shop-grid">
        {shop.map((item) => (
          <div className="shop-item" key={item.id}>
            <span>{item.icon}</span>
            <h3>{item.name}</h3>
            <small>
              {item.price} {tr("学习币", "coins")}
            </small>
            <button
              className="button secondary small"
              disabled={!user}
              onClick={async () => {
                try {
                  if (r.owned.includes(item.id))
                    await post("/rewards/equip", {
                      type: item.type,
                      item: item.id,
                    });
                  else await post("/rewards/purchase", { item: item.id });
                  await refresh();
                  onError(
                    r.owned.includes(item.id)
                      ? tr("已使用此奖励。", "Reward equipped.")
                      : tr(
                          "奖励已解锁，可以点击使用。",
                          "Reward unlocked. Select it to equip.",
                        ),
                  );
                } catch (e) {
                  onError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              {r.owned.includes(item.id)
                ? tr("使用", "Equip")
                : tr("解锁", "Unlock")}
            </button>
          </div>
        ))}
      </div>
    </Page>
  );
}
export function CodeLab({
  tr,
  onError,
  sandboxOrigin,
}: {
  tr: Tr;
  onError: (s: string) => void;
  sandboxOrigin: string | null;
}) {
  const [language, setLanguage] = useState<"python" | "sql">("python");
  return (
    <>
      <div className="segmented">
        <button
          className={language === "python" ? "active" : ""}
          onClick={() => setLanguage("python")}
        >
          Python
        </button>
        <button
          className={language === "sql" ? "active" : ""}
          onClick={() => setLanguage("sql")}
        >
          SQL
        </button>
      </div>
      <div className="lab-context">
        <Code2 size={21} />
        <p>
          {tr(
            "Python 支持 NumPy、pandas 和 Matplotlib。SQL 使用内存 SQLite。只会向运行区传入你选中的练习数据。",
            "Python supports NumPy, pandas and Matplotlib. SQL uses in-memory SQLite. Only selected exercise data is sent to the runtime.",
          )}
        </p>
      </div>
      <CodeRunner
        key={language}
        language={language}
        starter={
          language === "python"
            ? 'import pandas as pd\n\ndata = pd.DataFrame({\n    "week": [1, 2, 3, 4],\n    "questions": [3, 5, 4, 8],\n})\nprint(data)\nprint("Mean:", data["questions"].mean())'
            : "CREATE TABLE practice (week INTEGER, questions INTEGER);\nINSERT INTO practice VALUES (1,3),(2,5),(3,4),(4,8);\nSELECT AVG(questions) AS mean_questions FROM practice;"
        }
        onError={onError}
        sandboxOrigin={sandboxOrigin}
        tr={tr}
      />
    </>
  );
}
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
        subtitle={tr("正在读取平台运行状态…", "Loading operational status…")}
      >
        <LoaderCircle className="spin" />
      </Page>
    );
  return (
    <Page
      title={tr("管理控制台", "Admin console")}
      subtitle={tr(
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
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
