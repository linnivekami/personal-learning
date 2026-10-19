import { useEffect, useState } from "react";
import {
  LoaderCircle,
  Plus,
  NotebookPen,
  Save,
  Trash2,
  Download,
} from "lucide-react";
import type { Course, Note } from "../../../shared/types";
import { Page } from "../../ui/primitives";
import { RichText } from "../../lib/RichText";
import { api, post } from "../../lib/api";
import { download } from "../../lib/format";
type Tr = (a: string, b: string) => string;
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
      lead={tr(
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
