import type { Course } from "../../shared/types";
import type { Language } from "../app/i18n";
import { levelName, progressFor, nextGates } from "./mastery";
import { policy } from "../../shared/core";

/**
 * A teaching handoff for any AI tutor (ChatGPT, Claude, …), following the
 * Personal Learning OS protocol (personal-learning/SKILL.md): the tutor gets
 * the framework, the evidence-based state and the one next step, and is
 * asked to report attempts back as evidence rather than to grade mastery.
 */
export function teachingHandoff(
  course: Course,
  conceptId: string | null,
  language: Language,
) {
  const zh = language === "zh";
  const tr = (a: string, b: string) => (zh ? a : b);
  const focus = course.concepts.find((c) => c.id === conceptId);
  const lines: string[] = [];
  lines.push(
    tr(`# 学习交接 · ${course.title}`, `# Learning handoff · ${course.title}`),
    "",
    tr(
      "你是我的 Personal Learning 助教（Tutor / Coach / Examiner）。请严格遵守：",
      "You are my Personal Learning tutor (Tutor / Coach / Examiner). Follow these rules strictly:",
    ),
    tr(
      "1. 证据先于判断：看过、听懂、我说“会了”都不算掌握；一次答对只证明该题考查的能力。",
      "1. Evidence before judgement: reading, understanding or my saying “got it” is not mastery; one correct answer proves only the skill it tested.",
    ),
    tr(
      "2. 先推后命名：适合推导的结构先给需求让我推，再揭晓名称；我卡住时按提示阶梯逐级给提示，讲解是最后手段。",
      "2. Derive before naming: let me derive structures from the need before you name them; when I am stuck, give graded hints, and explain only as a last resort.",
    ),
    tr(
      "3. 结构判据优于死记：用维度、条件方向、内外位置等可检验的关系帮助我判断。",
      "3. Structural criteria over rote: help me judge with checkable relations (dimensions, direction of conditions, inside/outside).",
    ),
    tr(
      "4. 每次只给一个 5–15 分钟能开始的下一步。我答完后问我“几成把握（1–10）”。",
      "4. Give one next step I can start in 5–15 minutes. After I answer, ask how confident I am (1–10).",
    ),
    tr(
      `5. 掌握度 0–5 累积：2=无提示独立解释或应用；3=解释和应用都独立，并在 ≥${policy.mastery.minimumRetentionDays} 天后无提示复测通过；4=再加变式；5=再加跨情境迁移。不要替我改等级。`,
      `5. Mastery 0–5 is cumulative: 2 = explained or applied without hints; 3 = both, plus an unassisted retest after ≥${policy.mastery.minimumRetentionDays} days; 4 = plus a variation; 5 = plus cross-context transfer. Do not change my levels yourself.`,
    ),
    tr(
      "6. 每次作答后，用一行记录证据：日期 · 知识点 · 能力(解释/应用/变式/迁移/复测) · 结果(做到/部分/未做到/证据不足) · 提示次数 · 一句证据。",
      "6. After each attempt, log one evidence line: date · concept · ability (explanation/application/variation/transfer/review) · outcome (demonstrated/partial/not yet/unclear) · hints used · one-sentence evidence.",
    ),
    "",
    tr("## 课程", "## Course"),
    `- ${tr("目标", "Goal")}: ${course.goal}${course.examDate ? ` · ${tr("考试", "exam")} ${course.examDate}` : ""}`,
    `- ${tr("讲解偏好", "Preferred approach")}: ${course.strategy}`,
    course.description ? `- ${course.description}` : "",
    "",
    tr("## 知识框架与当前证据", "## Framework and current evidence"),
  );
  for (const c of course.concepts) {
    const s = course.state.concepts[c.id];
    const level = s?.mastery ?? 0;
    const parts = [
      `L${level} ${levelName(level, tr)}`,
      c.prerequisites.length
        ? `${tr("先修", "needs")}: ${c.prerequisites
            .map((id) => course.concepts.find((x) => x.id === id)?.title ?? id)
            .join(", ")}`
        : "",
      s?.nextReview
        ? `${tr("复习", "review")} ${s.nextReview.slice(0, 10)}`
        : "",
      s?.weaknesses.length
        ? `${tr("障碍", "gap")}: ${s.weaknesses.join("; ")}`
        : "",
    ].filter(Boolean);
    lines.push(
      `${c.parentId ? "  " : ""}- **${c.title}** — ${c.purpose || c.summary} (${parts.join(" · ")})`,
    );
  }
  const next = course.state.nextAction;
  lines.push("", tr("## 下一小步", "## Next small step"));
  if (focus) {
    const p = progressFor(course, focus.id);
    lines.push(
      tr(`当前知识点：**${focus.title}**`, `Focus: **${focus.title}**`),
      focus.summary,
      ...nextGates(p, tr).map((g) => `- [${g.done ? "x" : " "}] ${g.label}`),
    );
  }
  if (next)
    lines.push(
      `${tr("系统建议", "Suggested")}: ${next.title} — ${next.reason} (~${next.estimatedMinutes} min)`,
    );
  lines.push(
    "",
    tr(
      "请先用一个问题确认我现在的理解，再从下一小步开始。",
      "Start with one question that checks my current understanding, then begin the next small step.",
    ),
  );
  return lines
    .filter((l, i, all) => !(l === "" && all[i - 1] === ""))
    .join("\n");
}
