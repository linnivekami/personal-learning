import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Concept, Course } from "../../../shared/types";
import { useI18n } from "../../app/i18n";
import { Modal, Spinner } from "../../ui/primitives";

export function EditFramework({
  course,
  onClose,
  onSave,
}: {
  course: Course;
  onClose: () => void;
  onSave: (concepts: Concept[]) => Promise<void>;
}) {
  const { tr } = useI18n();
  const [concepts, setConcepts] = useState(course.concepts),
    [selected, setSelected] = useState(course.concepts[0]?.id ?? ""),
    [busy, setBusy] = useState(false);
  const node = concepts.find((n) => n.id === selected);
  const withEvidence = new Set(course.state.events.map((e) => e.conceptId));
  const change = (partial: Partial<Concept>) =>
    setConcepts(
      concepts.map((n) => (n.id === selected ? { ...n, ...partial } : n)),
    );
  const add = () => {
    const id = crypto.randomUUID();
    setConcepts([
      ...concepts,
      {
        id,
        title: tr("新的知识点", "New concept"),
        summary: "",
        purpose: "",
        prerequisites: [],
        parentId: null,
        applications: [],
        sourceIds: [],
      },
    ]);
    setSelected(id);
  };
  return (
    <Modal
      title={tr("编辑知识框架", "Edit the framework")}
      onClose={onClose}
      size="wide"
    >
      <div className="editor">
        <div
          className="editor-list"
          role="listbox"
          aria-label={tr("知识点", "Concepts")}
        >
          {concepts.map((n) => (
            <button
              key={n.id}
              role="option"
              aria-selected={selected === n.id}
              className={selected === n.id ? "active" : ""}
              onClick={() => setSelected(n.id)}
            >
              {n.parentId ? "  · " : ""}
              {n.title}
            </button>
          ))}
          <button className="text-button" onClick={add}>
            <Plus size={15} aria-hidden="true" />
            {tr("添加知识点", "Add a concept")}
          </button>
        </div>
        {node ? (
          <div className="form">
            <label>
              {tr("名称", "Title")}
              <input
                value={node.title}
                maxLength={120}
                onChange={(e) => change({ title: e.target.value })}
              />
            </label>
            <label>
              {tr(
                "为什么学它（要解决的问题）",
                "Why learn it (the problem it solves)",
              )}
              <input
                value={node.purpose}
                onChange={(e) => change({ purpose: e.target.value })}
              />
            </label>
            <label>
              {tr("核心含义", "Core meaning")}
              <textarea
                rows={3}
                value={node.summary}
                onChange={(e) => change({ summary: e.target.value })}
              />
            </label>
            <label>
              {tr("上级主题", "Parent topic")}
              <select
                value={node.parentId ?? ""}
                onChange={(e) => change({ parentId: e.target.value || null })}
              >
                <option value="">{tr("顶层", "Top level")}</option>
                {concepts
                  .filter((n) => n.id !== selected)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title}
                    </option>
                  ))}
              </select>
            </label>
            <fieldset>
              <legend>
                {tr(
                  "先修知识（学它之前需要会的）",
                  "Prerequisites (needed first)",
                )}
              </legend>
              <div className="check-grid">
                {concepts
                  .filter((n) => n.id !== selected)
                  .map((n) => (
                    <label className="check-label" key={n.id}>
                      <input
                        type="checkbox"
                        checked={node.prerequisites.includes(n.id)}
                        onChange={(e) =>
                          change({
                            prerequisites: e.target.checked
                              ? [...node.prerequisites, n.id]
                              : node.prerequisites.filter((id) => id !== n.id),
                          })
                        }
                      />
                      {n.title}
                    </label>
                  ))}
              </div>
            </fieldset>
            <label>
              {tr("应用场景，每行一个", "Applications, one per line")}
              <textarea
                rows={3}
                value={node.applications.join("\n")}
                onChange={(e) =>
                  change({
                    applications: e.target.value.split("\n").filter(Boolean),
                  })
                }
              />
            </label>
            <button
              className="text-button danger"
              disabled={withEvidence.has(node.id)}
              title={
                withEvidence.has(node.id)
                  ? tr(
                      "已有学习证据的知识点不能删除，可以重命名或调整关系。",
                      "Concepts with evidence cannot be removed; rename or relink them.",
                    )
                  : undefined
              }
              onClick={() => {
                setConcepts(
                  concepts
                    .filter((n) => n.id !== selected)
                    .map((n) => ({
                      ...n,
                      parentId: n.parentId === selected ? null : n.parentId,
                      prerequisites: n.prerequisites.filter(
                        (id) => id !== selected,
                      ),
                    })),
                );
                setSelected(concepts.find((n) => n.id !== selected)?.id ?? "");
              }}
            >
              <Trash2 size={15} aria-hidden="true" />
              {tr("移除此知识点", "Remove this concept")}
            </button>
          </div>
        ) : (
          <p className="muted">
            {tr("添加第一个知识点。", "Add the first concept.")}
          </p>
        )}
      </div>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          {tr("取消", "Cancel")}
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(concepts);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Spinner />}
          {tr("保存框架", "Save framework")}
        </button>
      </div>
    </Modal>
  );
}
