import { useMemo, useState } from "react";
import { Check, Clipboard, Download } from "lucide-react";
import type { Course } from "../../../shared/types";
import { useI18n } from "../../app/i18n";
import { useLearning } from "../../app/store";
import { Modal } from "../../ui/primitives";
import { teachingHandoff } from "../../lib/handoff";
import { download } from "../../lib/format";

export function HandoffModal({
  course,
  conceptId,
  onClose,
}: {
  course: Course;
  conceptId: string | null;
  onClose: () => void;
}) {
  const { tr, language } = useI18n();
  const L = useLearning();
  const text = useMemo(
    () => teachingHandoff(course, conceptId, language),
    [course, conceptId, language],
  );
  const [copied, setCopied] = useState(false);
  return (
    <Modal
      title={tr("交给我的 AI 助教", "Hand off to my AI tutor")}
      onClose={onClose}
      size="wide"
    >
      <p className="muted">
        {tr(
          "把下面这段发给 ChatGPT、Claude 或其他 AI 助教。它包含教学契约、知识框架、按证据计算的掌握度和下一小步；不包含你的账号或资料原文。",
          "Paste this into ChatGPT, Claude or another AI tutor. It carries the teaching contract, your framework, evidence-based levels and the next step — no account details or source files.",
        )}
      </p>
      <textarea
        className="handoff"
        readOnly
        value={text}
        rows={16}
        aria-label={tr("交接内容", "Handoff text")}
      />
      <p className="muted small">
        {tr(
          "AI 助教按契约记下的证据行，可以对照“证据”面板人工核对；平台不会根据外部对话自动提升等级。",
          "Evidence lines the tutor logs can be compared with the Evidence panel; the platform never raises levels from outside conversations automatically.",
        )}
      </p>
      <div className="modal-actions">
        <button
          className="button secondary"
          onClick={() =>
            download(`${course.title}-handoff.md`, text, "text/markdown")
          }
        >
          <Download size={16} aria-hidden="true" />
          {tr("下载 .md", "Download .md")}
        </button>
        <button
          className="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            } catch {
              L.notify(
                tr(
                  "无法访问剪贴板，请手动全选复制。",
                  "Clipboard unavailable; select and copy the text instead.",
                ),
              );
            }
          }}
        >
          {copied ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Clipboard size={16} aria-hidden="true" />
          )}
          {copied ? tr("已复制", "Copied") : tr("复制全文", "Copy all")}
        </button>
      </div>
    </Modal>
  );
}
