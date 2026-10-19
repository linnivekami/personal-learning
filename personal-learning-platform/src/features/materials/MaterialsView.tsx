import { useState } from "react";
import {
  Upload,
  FileText,
  Link2,
  LoaderCircle,
  Plus,
  ExternalLink,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type { Course, Material } from "../../../shared/types";
import { Page, Empty } from "../../ui/primitives";
import { api, post } from "../../lib/api";
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
      lead={`${course.title} · ${tr("保留原文与页码，让每次讲解有处可查。", "Keep original files and page references behind every explanation.")}`}
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
