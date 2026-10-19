import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  FileText,
  Library,
  LoaderCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { Concept } from "../../../shared/types";
import type {
  CheatSheet,
  CheatSheetOptions,
  CheatSheetSummary,
} from "../../../shared/cheatsheet";
import { useI18n } from "../../app/i18n";
import { useLearning } from "../../app/store";
import { Link } from "../../app/router";
import { api, cheatStream } from "../../lib/api";
import { shortDate } from "../../lib/format";
import { Empty, Notice, Page, Spinner } from "../../ui/primitives";
import { SheetPreview } from "./SheetPreview";

const STAGE_LABEL: Record<string, [string, string]> = {
  scope: ["读取考试范围与资料…", "Reading the exam scope and materials…"],
  front: ["生成正面三栏…", "Drafting the front three columns…"],
  back: ["生成反面三栏…", "Drafting the back three columns…"],
  pack: ["压缩排版为双面 A4…", "Packing the two A4 sides…"],
};

function summaryOf(sheet: CheatSheet): CheatSheetSummary {
  return {
    id: sheet.id,
    courseId: sheet.courseId,
    title: sheet.title,
    subtitle: sheet.subtitle,
    scope: sheet.scope,
    options: sheet.options,
    topicCount: sheet.topicCount,
    createdAt: sheet.createdAt,
  };
}

function groupConcepts(concepts: Concept[]) {
  const groups: { label: string; items: Concept[] }[] = [];
  const index = new Map<string, number>();
  for (const concept of concepts) {
    const parent = concept.parentId
      ? concepts.find((item) => item.id === concept.parentId)
      : undefined;
    const label = parent?.title ?? "Core";
    let at = index.get(label);
    if (at === undefined) {
      at = groups.length;
      index.set(label, at);
      groups.push({ label, items: [] });
    }
    groups[at].items.push(concept);
  }
  return groups;
}

export function CheatSheetPage() {
  const { tr } = useI18n();
  const L = useLearning();
  const own = !!L.user && !L.sample;

  if (!own)
    return (
      <Page
        title={tr("考试速查表", "Cheat sheet")}
        lead={tr(
          "把整门课压缩成严格两页 A4：正面一页、反面一页，每面三栏；按考试范围生成，公式与易错点可高亮。",
          "Compress a whole course into exactly two A4 sides — front and back, three columns each — scoped to your exam, with optional formula and mistake highlights.",
        )}
      >
        <Empty
          icon={FileText}
          title={
            L.user
              ? tr("先建立自己的课程", "Create your own course first")
              : tr("登录后生成速查表", "Sign in to build a cheat sheet")
          }
          text={
            L.user
              ? tr(
                  "速查表会从你自己的课程框架和资料中生成。先新建课程并导入课件。",
                  "A cheat sheet is generated from your own course framework and materials. Create a course and import materials first.",
                )
              : tr(
                  "速查表保存在你的账号中，按课程资料和考试范围生成。",
                  "Cheat sheets are saved to your account and generated from your course materials and exam scope.",
                )
          }
          action={
            L.user ? (
              <Link to={{ name: "courses" }} className="button">
                <Library size={17} aria-hidden="true" />
                {tr("我的课程", "My courses")}
              </Link>
            ) : (
              <button className="button" onClick={L.openLogin}>
                {tr("登录", "Sign in")}
              </button>
            )
          }
        />
      </Page>
    );

  if (!L.course.concepts.length)
    return (
      <Page
        title={tr("考试速查表", "Cheat sheet")}
        lead={tr(
          "课程还没有知识点，先把资料整理成知识框架。",
          "This course has no knowledge points yet. Organize your materials into a framework first.",
        )}
      >
        <Empty
          icon={BookOpen}
          title={tr("还没有可压缩的知识点", "Nothing to compress yet")}
          text={tr(
            "上传课件并「整理到知识框架」后，才能按考试范围生成两页速查表。",
            "Upload materials and organize them into the framework before generating a two-page sheet.",
          )}
          action={
            <Link to={{ name: "materials" }} className="button">
              <FileText size={17} aria-hidden="true" />
              {tr("去整理资料", "Go to materials")}
            </Link>
          }
        />
      </Page>
    );

  return <CheatSheetWorkbench />;
}

function CheatSheetWorkbench() {
  const { tr, language } = useI18n();
  const L = useLearning();
  const course = L.course;
  const [sheets, setSheets] = useState<CheatSheetSummary[]>([]);
  const [active, setActive] = useState<CheatSheet | null>(null);
  const [selected, setSelected] = useState<string[]>(() =>
    course.concepts.map((concept) => concept.id),
  );
  const [scope, setScope] = useState("");
  const [highlightFormulas, setHighlightFormulas] = useState(true);
  const [highlightMistakes, setHighlightMistakes] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [stage, setStage] = useState("");

  const options: CheatSheetOptions = useMemo(
    () => ({ highlightFormulas, highlightMistakes }),
    [highlightFormulas, highlightMistakes],
  );
  const groups = useMemo(() => groupConcepts(course.concepts), [course.concepts]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const ai = !!L.config?.services.model;

  useEffect(() => {
    setSelected(course.concepts.map((concept) => concept.id));
    setScope("");
    setActive(null);
  }, [course.id]);

  useEffect(() => {
    let live = true;
    setSheets([]);
    void api<{ sheets: CheatSheetSummary[] }>(
      `/courses/${course.id}/cheatsheets`,
    )
      .then(async (data) => {
        if (!live) return;
        setSheets(data.sheets);
        const first = data.sheets[0];
        if (!first) return;
        try {
          const loaded = await api<{ sheet: CheatSheet }>(
            `/cheatsheets/${first.id}`,
          );
          if (!live) return;
          setActive((old) => old ?? loaded.sheet);
          setHighlightFormulas(loaded.sheet.options.highlightFormulas);
          setHighlightMistakes(loaded.sheet.options.highlightMistakes);
        } catch {
          /* The history item can still be opened manually. */
        }
      })
      .catch((error: Error) => {
        if (live) L.notify(error.message);
      });
    return () => {
      live = false;
    };
  }, [course.id]);

  const open = async (id: string) => {
    setLoadingSheet(true);
    try {
      const data = await api<{ sheet: CheatSheet }>(`/cheatsheets/${id}`);
      setActive(data.sheet);
      setHighlightFormulas(data.sheet.options.highlightFormulas);
      setHighlightMistakes(data.sheet.options.highlightMistakes);
    } catch (error) {
      L.notify(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingSheet(false);
    }
  };

  const generate = async () => {
    if (!selected.length) {
      L.notify(tr("请至少选择一个知识点。", "Choose at least one knowledge point."));
      return;
    }
    setBusy(true);
    setStage("scope");
    let produced = false;
    try {
      await cheatStream(
        `/courses/${course.id}/cheatsheets`,
        {
          scope,
          conceptIds: selected,
          highlightFormulas,
          highlightMistakes,
        },
        (name, value) => {
          if (name === "status") {
            const data = value as { stage?: string };
            if (data.stage) setStage(data.stage);
          }
          if (name === "sheet") {
            const data = value as { sheet: CheatSheet };
            produced = true;
            setActive(data.sheet);
            setSheets((old) => [
              summaryOf(data.sheet),
              ...old.filter((item) => item.id !== data.sheet.id),
            ]);
          }
        },
      );
      if (!produced)
        throw new Error(
          tr(
            "生成流意外结束，请重试。",
            "The generation stream ended unexpectedly. Please try again.",
          ),
        );
      L.notify(
        tr(
          "速查表已生成，可以打印或存为 PDF。",
          "Cheat sheet ready to print or save as PDF.",
        ),
      );
    } catch (error) {
      L.notify(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/cheatsheets/${id}`, { method: "DELETE" });
      setSheets((old) => old.filter((sheet) => sheet.id !== id));
      if (active?.id === id) setActive(null);
    } catch (error) {
      L.notify(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Page
      wide
      title={tr("考试速查表", "Cheat sheet")}
      lead={tr(
        "按考试范围压缩成两页 A4：正面一页、反面一页，每面三栏。公式和易错点可以选择是否加粗高亮。",
        "Compress the exam scope into exactly two A4 sides — front and back, three columns each. Formulas and common mistakes can be highlighted.",
      )}
    >
      <div className="cs-workbench">
        <div className="cs-side">
          <section className="cs-config">
            <div className="cs-config-heading">
              <span className="eyebrow">{tr("生成设置", "Build settings")}</span>
              <h2>{tr("这一份速查表覆盖什么？", "What does this sheet cover?")}</h2>
            </div>

            {L.courses.length > 1 && (
              <label className="cs-field">
                <span>{tr("课程", "Course")}</span>
                <select
                  value={course.id}
                  onChange={(event) => L.selectCourse(event.target.value)}
                  disabled={busy}
                >
                  {L.courses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="cs-field">
              <span>
                {tr("考试范围说明", "Exam scope notes")}
                <small>
                  {tr(
                    "章节、Session、题型或明确排除的内容",
                    "Chapters, sessions, question types or exclusions",
                  )}
                </small>
              </span>
              <textarea
                rows={2}
                maxLength={2000}
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                disabled={busy}
                placeholder={tr(
                  "例如：Sessions 1–13，midterm；重点 S4 网络设计、S6 库存计算；排除 S4 gravity model",
                  "e.g. Sessions 1–13, midterm; focus on S4 network design and S6 inventory; exclude the S4 gravity model",
                )}
              />
            </label>

            <div className="cs-field">
              <div className="cs-field-head">
                <span>
                  {tr("知识点范围", "Knowledge points")}
                  <small>
                    {tr(
                      `已选 ${selected.length} / ${course.concepts.length}`,
                      `${selected.length} / ${course.concepts.length} selected`,
                    )}
                  </small>
                </span>
                <span className="cs-inline-actions">
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      setSelected(course.concepts.map((concept) => concept.id))
                    }
                  >
                    {tr("全选", "All")}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy || !selected.length}
                    onClick={() => setSelected([])}
                  >
                    {tr("清空", "None")}
                  </button>
                </span>
              </div>
              <div className="cs-concepts">
                {groups.map((group) => (
                  <div className="cs-concept-group" key={group.label}>
                    <div className="cs-group-label">{group.label}</div>
                    <div className="cs-concept-list">
                      {group.items.map((concept) => {
                        const on = selectedSet.has(concept.id);
                        return (
                          <label
                            key={concept.id}
                            className={`cs-concept ${on ? "on" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={busy}
                              onChange={() =>
                                setSelected((old) =>
                                  old.includes(concept.id)
                                    ? old.filter((id) => id !== concept.id)
                                    : [...old, concept.id],
                                )
                              }
                            />
                            <span>{concept.title}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="cs-options">
              <label className="cs-toggle">
                <input
                  type="checkbox"
                  checked={highlightFormulas}
                  onChange={(event) => setHighlightFormulas(event.target.checked)}
                  disabled={busy}
                />
                <span>
                  <strong>{tr("高亮公式", "Highlight formulas")}</strong>
                  <small>
                    {tr(
                      "公式加粗、加左框线；关闭后正常排版",
                      "Bold formulas with a rule; off renders them plain",
                    )}
                  </small>
                </span>
              </label>
              <label className="cs-toggle">
                <input
                  type="checkbox"
                  checked={highlightMistakes}
                  onChange={(event) => setHighlightMistakes(event.target.checked)}
                  disabled={busy}
                />
                <span>
                  <strong>{tr("高亮易错点", "Highlight mistakes")}</strong>
                  <small>
                    {tr(
                      "易错点加「!」标记与浅灰底；关闭后正常排版",
                      "Mistakes get a “!” badge and light grey box; off renders them plain",
                    )}
                  </small>
                </span>
              </label>
            </div>

            {ai ? (
              <button
                className="button full cs-generate"
                onClick={() => void generate()}
                disabled={busy || !selected.length}
              >
                {busy ? <Spinner /> : <Sparkles size={17} aria-hidden="true" />}
                {busy
                  ? tr("正在生成速查表…", "Building your cheat sheet…")
                  : tr("生成两页速查表", "Generate two-page sheet")}
              </button>
            ) : (
              <Notice tone="warn">
                {tr(
                  "模型服务尚未配置，暂时不能生成速查表。",
                  "The model service is not configured, so cheat sheets cannot be generated yet.",
                )}
              </Notice>
            )}
            <p className="cs-hint">
              {tr(
                "生成约需 30–90 秒；内容会压缩成 6 栏，每栏自动填满页面。速查表使用单独的大文档额度。",
                "Generation takes about 30–90 seconds. Content is packed into 6 columns and auto-fitted to fill each page. Cheat sheets use a separate large-document allowance.",
              )}
            </p>
            {busy && (
              <div className="cs-progress" role="status">
                <span className="cs-progress-bar" />
                <strong>{tr(...(STAGE_LABEL[stage] ?? STAGE_LABEL.scope))}</strong>
              </div>
            )}
          </section>

          {sheets.length > 0 && (
            <section className="cs-history">
              <div className="cs-history-head">
                <h2>{tr("已生成", "Saved sheets")}</h2>
                <span>{sheets.length}</span>
              </div>
              <div className="cs-history-list">
                {sheets.map((sheet) => (
                  <div
                    key={sheet.id}
                    className={`cs-history-item ${active?.id === sheet.id ? "active" : ""}`}
                  >
                    <button
                      className="cs-history-open"
                      onClick={() => void open(sheet.id)}
                      disabled={busy || loadingSheet}
                    >
                      <strong>{sheet.title}</strong>
                      <small>
                        {shortDate(sheet.createdAt, language)} ·{" "}
                        {tr(
                          `${sheet.topicCount} 个知识点`,
                          `${sheet.topicCount} topics`,
                        )}
                      </small>
                      <span>{sheet.scope || sheet.subtitle}</span>
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label={tr("删除这份速查表", "Delete this sheet")}
                      onClick={() => void remove(sheet.id)}
                      disabled={busy}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="cs-main">
          {active ? (
            <SheetPreview sheet={active} options={options} />
          ) : (
            <div className="cs-preview-empty">
              {loadingSheet ? (
                <LoaderCircle size={26} className="spin" />
              ) : (
                <FileText size={30} strokeWidth={1.4} />
              )}
              <h2>
                {tr("两页 A4，正面 + 反面", "Two A4 sides, front + back")}
              </h2>
              <p>
                {tr(
                  "左侧选定考试范围后生成。预览会按每栏实际高度自动缩放字号、调整小框间距与行距，尽量填满纸张。",
                  "Choose the exam scope on the left, then generate. The preview fits each column by adjusting type size, box gaps and leading so the paper is filled.",
                )}
              </p>
              <ul>
                <li>{tr("严格两页：每面三栏", "Exactly two pages: three columns each")}</li>
                <li>{tr("纯黑白、无图片", "Black and white, no images")}</li>
                <li>{tr("中英混排，保留术语与变量", "Mixed Chinese/English, terms and variables preserved")}</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
