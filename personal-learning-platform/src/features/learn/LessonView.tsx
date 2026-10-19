import { useState } from "react";
import {
  ArrowUpRight,
  BrainCircuit,
  Clipboard,
  FileText,
  Layers3,
  Lightbulb,
  Link2,
  MessageCircle,
  NotebookPen,
  Send,
  Sparkles,
} from "lucide-react";
import type {
  Concept,
  Course,
  Lesson,
  SourceRef,
  Strategy,
} from "../../../shared/types";
import { useI18n } from "../../app/i18n";
import { useLearning } from "../../app/store";
import { Link } from "../../app/router";
import { RichText } from "../../lib/RichText";
import { Recorder, Speaker } from "../../lib/Voice";
import { PracticeCard } from "../practice/PracticeCard";
import { Notice, Spinner, Station } from "../../ui/primitives";
import { levelName, masteryOf } from "../../lib/mastery";
import { strategies, useSaveSample } from "../courses/CreateCourse";
import type { TeachKind } from "./LearnPage";

export function LessonView({
  course,
  concept,
  lesson,
  sources,
  guest,
  sample,
  busy,
  status,
  teach,
  onStrategy,
  onEvidence,
  onMap,
  onHandoff,
}: {
  course: Course;
  concept: Concept | null;
  lesson: Lesson;
  sources: SourceRef[];
  guest: boolean;
  sample: boolean;
  busy: boolean;
  status: string;
  teach: (
    kind: TeachKind,
    request?: string,
    override?: Strategy,
  ) => Promise<boolean>;
  onStrategy: (s: Strategy) => void;
  onEvidence: () => void;
  onMap: () => void;
  onHandoff: () => void;
}) {
  const { tr } = useI18n();
  const L = useLearning();
  const saveSample = useSaveSample();
  const [request, setRequest] = useState("");
  const ai = !!L.config?.services.model;
  const level = concept ? masteryOf(course, concept.id) : 0;
  const state = concept ? course.state.concepts[concept.id] : undefined;
  const aiOff = !guest && !ai;
  const ask = async () => {
    if (!request.trim()) return;
    if (await teach("explain", request)) setRequest("");
  };
  return (
    <article className="lesson" aria-labelledby="lesson-title">
      {sample && (
        <div className="sample-strip">
          <span>
            <span className="pill signal">{tr("示例", "Sample")}</span>
            {tr(
              "内置示例课程：掌握度和记录从你自己的作答开始。",
              "Built-in sample: mastery and records start with your own work.",
            )}
          </span>
          <button className="text-link" onClick={() => void saveSample()}>
            {L.user
              ? tr("保存为我的课程", "Make this my course")
              : tr("登录后开始", "Sign in to start")}
            <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="lesson-topline">
        <span className="lesson-position">
          {lesson.position || course.title}
        </span>
        <div className="lesson-controls">
          <button className="text-button" onClick={onMap}>
            <Layers3 size={15} aria-hidden="true" />
            {tr("整体位置", "Bigger picture")}
          </button>
          <label className="visually-hidden" htmlFor="strategy">
            {tr("讲解路径", "Teaching approach")}
          </label>
          <select
            id="strategy"
            className="chip-select"
            value={course.strategy}
            onChange={(e) => onStrategy(e.target.value as Strategy)}
          >
            {Object.entries(strategies).map(([id, v]) => (
              <option key={id} value={id}>
                {tr(...v)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <h1 id="lesson-title">
        {lesson.title || concept?.title || course.title}
      </h1>
      <p className="lesson-purpose">
        {lesson.purpose || concept?.purpose || course.description}
      </p>
      {concept && (
        <button className="mastery-row" onClick={onEvidence}>
          <Station level={level} size={20} label={false} />
          <span>
            <strong>
              L{level} · {levelName(level, tr)}
            </strong>
            <small>
              {state?.weaknesses.length
                ? tr(
                    `待修复：${state.weaknesses.length} 处障碍`,
                    `${state.weaknesses.length} gap(s) to repair`,
                  )
                : state?.nextReview
                  ? tr(
                      `下次复习 ${state.nextReview.slice(0, 10)}`,
                      `Next review ${state.nextReview.slice(0, 10)}`,
                    )
                  : tr("查看证据与下一关", "See the evidence and next gate")}
            </small>
          </span>
          <span className="text-link">{tr("证据", "Evidence")}</span>
        </button>
      )}
      <div className="why">
        <Lightbulb size={18} aria-hidden="true" />
        <div>
          <strong>{tr("为什么学这一点？", "Why this idea matters")}</strong>
          <p>{concept?.purpose || course.description}</p>
        </div>
        <span className="muted small">{tr("约 10 分钟", "About 10 min")}</span>
      </div>
      {busy && (
        <div className="thinking" role="status">
          <Spinner />
          {status}
        </div>
      )}
      <div className="lesson-body">
        <RichText
          text={lesson.body || concept?.summary || course.description}
        />
      </div>
      {!!lesson.connections.length && (
        <div className="connections">
          <span className="section-kicker">
            <Link2 size={15} aria-hidden="true" />
            {tr("把知识连起来", "Connect the ideas")}
          </span>
          <ul>
            {lesson.connections.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {aiOff && (
        <Notice tone="signal" icon={Sparkles}>
          <strong>
            {tr("AI 讲解尚未开启", "AI teaching is not enabled yet")}
          </strong>
          <p>
            {tr(
              "知识框架、笔记、证据与复习计划照常可用。想现在就练习，可以把这门课的状态交给你自己的 AI 助教（ChatGPT、Claude 等），按同一套教学契约继续。",
              "Your framework, notes, evidence and review plan all work. To practise now, hand this course's state to your own AI tutor (ChatGPT, Claude…) under the same teaching contract.",
            )}
          </p>
          <button className="button secondary small" onClick={onHandoff}>
            <Clipboard size={15} aria-hidden="true" />
            {tr("交给我的 AI 助教", "Hand off to my AI tutor")}
          </button>
        </Notice>
      )}
      <div className="lesson-actions">
        <button
          className="button secondary small"
          disabled={busy || aiOff}
          onClick={() => void teach("lesson")}
        >
          <Sparkles size={15} aria-hidden="true" />
          {tr("继续展开讲解", "Explain further")}
        </button>
        <button
          className="button secondary small"
          disabled={busy || aiOff}
          onClick={() =>
            void teach(
              "practice",
              tr(
                "请围绕当前理解给一道适当难度的独立练习。",
                "Give me an appropriately challenging independent practice task.",
              ),
            )
          }
        >
          <BrainCircuit size={15} aria-hidden="true" />
          {tr("给我一道练习", "Give me practice")}
        </button>
        <button
          className="button secondary small"
          disabled={busy || aiOff}
          onClick={() =>
            void teach(
              "summary",
              "生成有层次的知识总结，标出联系和待确认理解。",
            )
          }
        >
          <NotebookPen size={15} aria-hidden="true" />
          {tr("梳理成总结", "Connected summary")}
        </button>
        <Link to={{ name: "cheatsheet" }} className="button secondary small">
          <FileText size={15} aria-hidden="true" />
          {tr("生成速查表", "Make a cheat sheet")}
        </Link>
        {!aiOff && (
          <button className="text-button" onClick={onHandoff}>
            <Clipboard size={15} aria-hidden="true" />
            {tr("交给我的 AI 助教", "Hand off to my AI tutor")}
          </button>
        )}
      </div>
      <Speaker
        text={lesson.body || concept?.summary || ""}
        language={course.language}
        onError={L.notify}
        tr={tr}
      />
      <div className="practice-stack">
        {lesson.cards.map((card) => (
          <PracticeCard
            key={card.id}
            card={card}
            course={course}
            guest={guest}
            onCourse={(c) => {
              L.updateCourse(c);
              void L.refresh();
            }}
            onError={L.notify}
            sandboxOrigin={L.config?.sandboxOrigin ?? null}
            tr={tr}
          />
        ))}
      </div>
      {!!sources.length && (
        <details className="sources">
          <summary>
            {tr("来源与资料位置", "Sources and locations")} · {sources.length}
          </summary>
          <ul>
            {sources.map((s) => (
              <li key={s.id}>
                <FileText size={15} aria-hidden="true" />
                <span>
                  {s.title}
                  {s.page
                    ? ` · ${tr("第", "p. ")}${s.page}${tr("页", "")}`
                    : ""}
                </span>
                {s.materialId ? (
                  <a
                    href={`/api/v1/materials/${s.materialId}/file?normalized=1#page=${s.page ?? 1}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tr("回看原文", "View source")}
                  </a>
                ) : s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {tr("网页", "Web page")}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="composer">
        <label htmlFor="composer" className="section-kicker">
          <MessageCircle size={16} aria-hidden="true" />
          {tr("有一个地方还没连上？", "Is a connection still unclear?")}
        </label>
        <textarea
          id="composer"
          rows={2}
          value={request}
          disabled={aiOff}
          onChange={(e) => setRequest(e.target.value)}
          placeholder={
            aiOff
              ? tr(
                  "开启 AI 讲解后可以在这里提问。",
                  "Ask here once AI teaching is enabled.",
                )
              : tr(
                  "说说你卡在哪里，或试着说出自己的理解…",
                  "Say where you are stuck, or try explaining it yourself…",
                )
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void ask();
            }
          }}
        />
        <div className="composer-bottom">
          <Recorder
            tr={tr}
            onText={(s) => setRequest(request ? `${request}\n${s}` : s)}
            onError={L.notify}
          />
          <span className="muted small">
            {tr(
              "⌘/Ctrl + Enter 发送 · 随时换一种讲法",
              "⌘/Ctrl + Enter to send · ask for another explanation anytime",
            )}
          </span>
          <button
            className="icon-button filled"
            aria-label={tr("发送问题", "Send question")}
            disabled={busy || !request.trim() || aiOff}
            onClick={() => void ask()}
          >
            <Send size={17} />
          </button>
        </div>
      </div>
      <p className="lesson-footer">
        {tr(
          "看懂只是开始。能独立解释和应用，并且隔几天仍然做得到，才是你自己的知识。",
          "Understanding is the start. Explaining and applying it yourself — and still doing so days later — makes it yours.",
        )}
      </p>
    </article>
  );
}
