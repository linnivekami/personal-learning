import type { Tr } from "../app/i18n";
import type { Course, LearningEvent } from "../../shared/types";
import { masteryProgress, type MasteryProgress } from "../../shared/core";

// Wording follows the teaching contract (shared/teaching-contract.md):
// cumulative levels, each proven by independent evidence.
export function levelName(level: number, tr: Tr) {
  return [
    tr("未开始", "Not started"),
    tr("接触过", "Exposed"),
    tr("独立做到", "Independent"),
    tr("间隔后保持", "Retained"),
    tr("能做变式", "Varies"),
    tr("能迁移", "Transfers"),
  ][Math.max(0, Math.min(5, level))];
}
export function levelHint(level: number, tr: Tr) {
  return [
    tr("还没有学习证据。", "No learning evidence yet."),
    tr(
      "读过讲解、或在提示下做对；还不算独立掌握。",
      "Read an explanation or succeeded with help; not yet independent.",
    ),
    tr(
      "无提示独立解释或应用过一次。",
      "Explained or applied it once without help.",
    ),
    tr(
      "解释和应用都独立做到，并在 2 天以上的间隔后无提示复测通过。",
      "Explained and applied independently, then passed an unassisted retest after 2+ days.",
    ),
    tr(
      "在此基础上独立完成了变式题。",
      "Additionally solved a variation independently.",
    ),
    tr(
      "在此基础上完成了结构不同的跨情境迁移。",
      "Additionally transferred it to a structurally different context.",
    ),
  ][Math.max(0, Math.min(5, level))];
}

export interface Gate {
  label: string;
  done: boolean;
}
/** What the next level still needs, as a checklist. */
export function nextGates(p: MasteryProgress, tr: Tr): Gate[] {
  if (p.level >= 5) return [];
  if (p.level <= 1)
    return [
      {
        label: tr(
          "无提示独立解释，或独立应用一次",
          "Explain or apply it once without hints",
        ),
        done: false,
      },
    ];
  if (p.level === 2)
    return [
      {
        label: tr("独立解释（不看提示）", "Explain it without hints"),
        done: p.independent.explanation,
      },
      {
        label: tr("独立应用（不看提示）", "Apply it without hints"),
        done: p.independent.application,
      },
      {
        label: tr(
          "间隔 2 天以上，无提示复测解释",
          "After 2+ days, retest the explanation unassisted",
        ),
        done: p.retained.explanation,
      },
      {
        label: tr(
          "间隔 2 天以上，无提示复测应用",
          "After 2+ days, retest the application unassisted",
        ),
        done: p.retained.application,
      },
    ];
  if (p.level === 3)
    return [
      {
        label: tr("独立完成一道变式题", "Solve a variation independently"),
        done: p.variation,
      },
    ];
  return [
    {
      label: tr(
        "完成一次结构不同的跨情境迁移",
        "Transfer to a structurally different context",
      ),
      done: p.transfer,
    },
  ];
}

export function conceptEvents(course: Course, conceptId: string) {
  return course.state.events.filter((e) => e.conceptId === conceptId);
}
export function progressFor(course: Course, conceptId: string) {
  return masteryProgress(conceptEvents(course, conceptId));
}
export function masteryOf(course: Course, conceptId: string) {
  return course.state.concepts[conceptId]?.mastery ?? 0;
}
export function verifiedCount(course: Course) {
  return course.concepts.filter((c) => masteryOf(course, c.id) >= 3).length;
}

export function abilityName(ability: LearningEvent["ability"], tr: Tr) {
  return (
    {
      exposure: tr("学习讲解", "Studied"),
      explanation: tr("解释", "Explanation"),
      recall: tr("回忆", "Recall"),
      application: tr("应用", "Application"),
      variation: tr("变式", "Variation"),
      transfer: tr("迁移", "Transfer"),
      review: tr("复测", "Review"),
    } as Record<string, string>
  )[ability];
}
export function outcomeName(outcome: LearningEvent["outcome"], tr: Tr) {
  return (
    {
      demonstrated: tr("做到", "Demonstrated"),
      partial: tr("部分做到", "Partial"),
      not_demonstrated: tr("未做到", "Not yet"),
      insufficient: tr("证据不足", "Unclear"),
    } as Record<string, string>
  )[outcome];
}
