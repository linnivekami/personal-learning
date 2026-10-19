import { Check, Circle, ShieldAlert } from "lucide-react";
import type { Concept, Course } from "../../../shared/types";
import { useI18n } from "../../app/i18n";
import { Modal, Notice, Station } from "../../ui/primitives";
import {
  abilityName,
  conceptEvents,
  levelHint,
  levelName,
  masteryOf,
  nextGates,
  outcomeName,
  progressFor,
} from "../../lib/mastery";
import { dueLabel, shortDate } from "../../lib/format";

/** Why a concept is at its level, what the next level needs, and the record. */
export function EvidenceSheet({
  course,
  concept,
  onClose,
}: {
  course: Course;
  concept: Concept;
  onClose: () => void;
}) {
  const { tr, language } = useI18n();
  const level = masteryOf(course, concept.id);
  const progress = progressFor(course, concept.id);
  const gates = nextGates(progress, tr);
  const state = course.state.concepts[concept.id];
  const events = conceptEvents(course, concept.id)
    .slice()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const waiting =
    level === 2 &&
    progress.retestFrom &&
    new Date(progress.retestFrom).getTime() > Date.now();
  return (
    <Modal
      title={`${tr("掌握度证据", "Mastery evidence")} · ${concept.title}`}
      onClose={onClose}
      side
    >
      <ol
        className="level-ladder"
        aria-label={tr("掌握等级", "Mastery levels")}
      >
        {[0, 1, 2, 3, 4, 5].map((l) => (
          <li
            key={l}
            className={l === level ? "here" : l < level ? "passed" : ""}
          >
            <Station level={l} size={18} current={l === level} label={false} />
            <div>
              <strong>
                L{l} · {levelName(l, tr)}
                {l === level && (
                  <span className="pill signal">{tr("当前", "Now")}</span>
                )}
              </strong>
              <small>{levelHint(l, tr)}</small>
            </div>
          </li>
        ))}
      </ol>
      {progress.capped && (
        <Notice tone="warn" icon={ShieldAlert}>
          {tr(
            "一次可靠的间隔复测没有通过，等级下调了一级。补救练习不会立刻升回，需要间隔后再次无提示证明。",
            "A reliable delayed retest failed, so the level dropped by one. Assisted repair does not restore it; prove it again unassisted after a gap.",
          )}
        </Notice>
      )}
      {gates.length > 0 && (
        <section className="sheet-section">
          <h3>
            {tr(
              `升到 L${Math.min(5, Math.max(2, level + 1))} 还需要`,
              `To reach L${Math.min(5, Math.max(2, level + 1))}`,
            )}
          </h3>
          <ul className="gates">
            {gates.map((g) => (
              <li key={g.label} className={g.done ? "done" : ""}>
                {g.done ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <Circle size={16} aria-hidden="true" />
                )}
                <span>{g.label}</span>
                <span className="visually-hidden">
                  {g.done ? tr("已完成", "done") : tr("未完成", "not yet")}
                </span>
              </li>
            ))}
          </ul>
          {waiting && progress.retestFrom && (
            <p className="muted small">
              {tr(
                `最早可在 ${shortDate(progress.retestFrom, language)} 复测，提前做的题算作练习，不算保持。`,
                `The earliest retest that counts is ${shortDate(progress.retestFrom, language)}; earlier tries count as practice, not retention.`,
              )}
            </p>
          )}
        </section>
      )}
      {(state?.weaknesses.length ?? 0) > 0 && (
        <section className="sheet-section">
          <h3>{tr("待修复的障碍", "Gaps to repair")}</h3>
          <ul className="plain">
            {state!.weaknesses.map((w) => (
              <li key={w}>{w.replace(/^[a-z]+:/, "")}</li>
            ))}
          </ul>
        </section>
      )}
      {state?.nextReview && (
        <p className="muted">
          {tr("下次复习：", "Next review: ")}
          {dueLabel(state.nextReview, tr, language)}
        </p>
      )}
      <section className="sheet-section">
        <h3>{tr("证据记录", "Evidence record")}</h3>
        {events.length ? (
          <ol className="timeline">
            {events.map((e) => (
              <li key={e.id}>
                <span className={`tick ${e.outcome}`} aria-hidden="true" />
                <div>
                  <strong>
                    {abilityName(e.ability, tr)} ·{" "}
                    {e.ability === "exposure"
                      ? tr("不计入掌握", "not counted")
                      : outcomeName(e.outcome, tr)}
                  </strong>
                  <small>
                    {shortDate(e.occurredAt, language)}
                    {e.assistance > 0 && e.ability !== "exposure"
                      ? ` · ${tr(`提示 ${e.assistance} 级`, `hint level ${e.assistance}`)}`
                      : e.ability !== "exposure"
                        ? ` · ${tr("无提示", "no hints")}`
                        : ""}
                    {e.confidence
                      ? ` · ${tr("把握", "confidence")} ${e.confidence}/10`
                      : ""}
                    {e.source === "objective"
                      ? ` · ${tr("客观题只证明识别，不计入独立掌握", "objective item: shows recognition, not independent mastery")}`
                      : ""}
                    {["legacy", "self_report"].includes(e.source)
                      ? ` · ${tr("历史/自述，不计入", "legacy/self-report, not counted")}`
                      : ""}
                  </small>
                  {e.evidence && e.ability !== "exposure" && (
                    <p>{e.evidence}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">
            {tr(
              "还没有记录。完成一道练习后，这里会出现可核对的证据。",
              "Nothing recorded yet. Finish a practice task and checkable evidence appears here.",
            )}
          </p>
        )}
      </section>
    </Modal>
  );
}
