import { useState, useMemo, useEffect, useRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Lightbulb,
  LoaderCircle,
  Upload,
  ArrowRight,
  Image as ImageIcon,
} from "lucide-react";
import type { LearningCard, Course, LearningEvent } from "../shared/types";
import { RichText } from "./RichText";
import { Recorder } from "./Voice";
import { CodeRunner } from "./CodeRunner";
import { api, post } from "./api";
type Tr = (a: string, b: string) => string;
export function PracticeCard({
  card,
  course,
  guest,
  onCourse,
  onError,
  tr,
  sandboxOrigin,
}: {
  card: LearningCard;
  course: Course;
  guest: boolean;
  onCourse: (c: Course) => void;
  onError: (s: string) => void;
  tr: Tr;
  sandboxOrigin: string | null;
}) {
  const draftKey = `pl:draft:${course.id}:${card.id}`;
  const draft = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(draftKey) ?? "{}");
    } catch {
      return {};
    }
  }, [draftKey]);
  const pending = useRef<{ fingerprint: string; id: string } | null>(
    draft.pending ?? null,
  );
  const [answer, setAnswer] = useState<string>(draft.answer ?? ""),
    [selected, setSelected] = useState<string[]>(draft.selected ?? []),
    [order, setOrder] = useState<string[]>(
      draft.order ?? card.options?.map((o) => o.id) ?? [],
    ),
    [matches, setMatches] = useState<Record<string, string>>(
      draft.matches ?? {},
    ),
    [hints, setHints] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState<{
      outcome: string;
      feedback: string;
    } | null>(null),
    [confidence, setConfidence] = useState<number | null>(null),
    [imageId, setImageId] = useState<string | undefined>(),
    [stepText, setStepText] = useState<string[]>(draft.stepText ?? [""]);
  useEffect(() => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          answer,
          selected,
          order,
          matches,
          stepText,
          pending: pending.current,
        }),
      );
    } catch {}
  }, [draftKey, answer, selected, order, matches, stepText]);
  if (card.kind === "simulation") return <Simulation card={card} tr={tr} />;
  if (card.kind === "explanation")
    return (
      <section className="explanation-inline">
        <h3>{card.title}</h3>
        <RichText text={card.body} />
      </section>
    );
  const finalAnswer =
    card.kind === "choice"
      ? (selected[0] ?? "")
      : card.kind === "multi_choice"
        ? selected.slice().sort().join(",")
        : card.kind === "order"
          ? order.join(",")
          : card.kind === "match"
            ? (card.pairs ?? [])
                .map((p) => `${p.left}=${matches[p.left] ?? ""}`)
                .join(";")
            : card.kind === "steps"
              ? stepText
                  .filter((s) => s.trim())
                  .map((s, i) => `${i + 1}. ${s}`)
                  .join("\n")
              : answer;
  const submit = async () => {
    if (!finalAnswer.trim() && !imageId) {
      onError(tr("先尝试作答，再提交。", "Try an answer before submitting."));
      return;
    }
    setBusy(true);
    try {
      if (guest) {
        if (["choice", "multi_choice", "order", "match"].includes(card.kind)) {
          const correct = finalAnswer === card.solution;
          setFeedback({
            outcome: correct ? "demonstrated" : "not_demonstrated",
            feedback: tr(
              `${correct ? "判断正确。" : "再检查一下条件范围。"}这是示例练习，不会写入个人学习档案。`,
              `${correct ? "Correct." : "Check the condition again."} This sample result is not saved to a learning profile.`,
            ),
          });
        } else
          onError(
            tr(
              "请登录并打开自己的课程，才能保存答案和使用 AI 反馈。",
              "Sign in and open your course to save answers and use AI feedback.",
            ),
          );
        return;
      }
      const fingerprint = JSON.stringify({
        answer: finalAnswer,
        imageId,
        confidence,
        assistance: hints.length,
      });
      if (pending.current?.fingerprint !== fingerprint)
        pending.current = { fingerprint, id: crypto.randomUUID() };
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            answer,
            selected,
            order,
            matches,
            stepText,
            pending: pending.current,
          }),
        );
      } catch {}
      const out = await post<{
        course: Course;
        evaluation?: { outcome: string; feedback: string };
        duplicate?: boolean;
        event: LearningEvent;
      }>(`/courses/${course.id}/attempts`, {
        attemptId: pending.current.id,
        assessmentId: card.id,
        answer:
          finalAnswer ||
          tr(
            "请根据附图评估我的解答。",
            "Please evaluate my answer in the attached image.",
          ),
        assistance: Math.min(5, hints.length),
        confidence,
        imageMaterialId: imageId,
      });
      onCourse(out.course);
      setFeedback(
        out.evaluation ?? {
          outcome: out.event.outcome,
          feedback: tr("已记录这次作答。", "This attempt has been recorded."),
        },
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const hint = async () => {
    if (guest) {
      const next = card.hints?.[hints.length];
      if (next) setHints([...hints, next]);
      else onError(tr("示例提示已全部展开。", "All sample hints are open."));
      return;
    }
    try {
      const out = await post<{ hint: string; course: Course }>(
        `/assessments/${card.id}/hint`,
        {},
      );
      setHints([...hints, out.hint]);
      onCourse(out.course);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <section className="practice-card" aria-label={card.title}>
      <div className="practice-heading">
        <span className="practice-symbol">✦</span>
        <span>{tr("把理解变成自己的", "Make the understanding yours")}</span>
        <span className="difficulty">
          {tr("难度", "Level")} {card.difficulty}/5
        </span>
      </div>
      <h3>{card.title}</h3>
      <RichText text={card.body} />
      {["choice", "multi_choice"].includes(card.kind) && (
        <div className="options">
          {card.options?.map((o, i) => (
            <button
              key={o.id}
              className={`option ${selected.includes(o.id) ? "chosen" : ""}`}
              onClick={() =>
                setSelected(
                  card.kind === "choice"
                    ? [o.id]
                    : selected.includes(o.id)
                      ? selected.filter((x) => x !== o.id)
                      : [...selected, o.id],
                )
              }
              aria-pressed={selected.includes(o.id)}
            >
              <span className="option-letter">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{o.text}</span>
              {selected.includes(o.id) && <Check size={17} />}
            </button>
          ))}
        </div>
      )}
      {card.kind === "order" && (
        <ol className="order-list">
          {order.map((id, i) => (
            <li key={id}>
              <span>{i + 1}</span>
              <p>{card.options?.find((o) => o.id === id)?.text}</p>
              <button
                className="icon-button"
                disabled={!i}
                aria-label={tr("上移", "Move up")}
                onClick={() => {
                  const n = [...order];
                  [n[i - 1], n[i]] = [n[i], n[i - 1]];
                  setOrder(n);
                }}
              >
                <ArrowUp size={16} />
              </button>
              <button
                className="icon-button"
                disabled={i === order.length - 1}
                aria-label={tr("下移", "Move down")}
                onClick={() => {
                  const n = [...order];
                  [n[i + 1], n[i]] = [n[i], n[i + 1]];
                  setOrder(n);
                }}
              >
                <ArrowDown size={16} />
              </button>
            </li>
          ))}
        </ol>
      )}
      {card.kind === "match" && (
        <div className="match-list">
          {card.pairs?.map((p) => (
            <label key={p.left}>
              <span>{p.left}</span>
              <select
                value={matches[p.left] ?? ""}
                onChange={(e) =>
                  setMatches({ ...matches, [p.left]: e.target.value })
                }
              >
                <option value="">{tr("选择对应项", "Choose a match")}</option>
                {card.pairs
                  ?.map((p) => p.right)
                  .sort()
                  .map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {["python", "sql"].includes(card.kind) && (
        <CodeRunner
          language={card.kind as "python" | "sql"}
          starter={
            card.starter ??
            (card.kind === "python"
              ? 'print("Hello, learning")'
              : "SELECT 1 AS answer;")
          }
          onAnswer={setAnswer}
          onError={onError}
          sandboxOrigin={sandboxOrigin}
          tr={tr}
        />
      )}
      {card.kind === "steps" && (
        <div className="step-answer">
          {stepText.map((s, i) => (
            <label key={i}>
              <span>{i + 1}</span>
              <input
                value={s}
                aria-label={`${tr("步骤", "Step")} ${i + 1}`}
                onChange={(e) =>
                  setStepText(
                    stepText.map((v, j) => (j === i ? e.target.value : v)),
                  )
                }
              />
            </label>
          ))}
          <button
            className="text-button"
            onClick={() => setStepText([...stepText, ""])}
          >
            + {tr("补充一步", "Add a step")}
          </button>
        </div>
      )}
      {!["choice", "multi_choice", "order", "match", "steps"].includes(
        card.kind,
      ) && (
        <div className="answer-box">
          <textarea
            rows={4}
            placeholder={
              card.kind === "formula"
                ? tr(
                    "输入公式或推导过程，可使用 LaTeX…",
                    "Enter a formula or derivation using LaTeX…",
                  )
                : tr(
                    "按自己的理解写下来，也可以先说出来…",
                    "Explain it in your own words, or record a voice message…",
                  )
            }
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          {card.kind === "formula" && answer && (
            <RichText text={`$${answer}$`} />
          )}
          <div className="answer-tools">
            <Recorder
              tr={tr}
              onText={(s) => setAnswer(answer ? `${answer}\n${s}` : s)}
              onError={onError}
            />
            <label
              className="icon-button"
              title={tr("附上解答照片", "Attach an answer image")}
            >
              <ImageIcon size={18} />
              <input
                hidden
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (guest) {
                    onError(
                      tr(
                        "请先登录以保存图片答案。",
                        "Sign in to upload an answer image.",
                      ),
                    );
                    return;
                  }
                  try {
                    const form = new FormData();
                    form.append("file", f);
                    form.append("purpose", "answer");
                    const r = await api<{ material: { id: string } }>(
                      `/courses/${course.id}/materials`,
                      { method: "POST", body: form },
                    );
                    setImageId(r.material.id);
                  } catch (e) {
                    onError(e instanceof Error ? e.message : String(e));
                  }
                }}
              />
            </label>
            {imageId && <small>{tr("图片已附上", "Image attached")}</small>}
            <span>
              {tr(
                "语音转写可修改后再提交",
                "Edit the voice transcript before submitting",
              )}
            </span>
          </div>
        </div>
      )}
      {hints.map((h, i) => (
        <div className="hint" key={i}>
          <Lightbulb size={16} />
          <RichText text={h} />
        </div>
      ))}
      <div className="confidence">
        <label>
          {tr("这次有多大把握？（可选）", "How confident are you? (Optional)")}
        </label>
        <div>
          {[2, 4, 6, 8, 10].map((n) => (
            <button
              key={n}
              className={confidence === n ? "active" : ""}
              onClick={() => setConfidence(confidence === n ? null : n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="practice-actions">
        <button className="text-button" onClick={() => void hint()}>
          <Lightbulb size={16} />
          {tr("给我一个提示", "Give me a hint")}
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? <LoaderCircle size={17} className="spin" /> : null}
          {tr("提交我的思考", "Submit my thinking")}
          <ArrowRight size={16} />
        </button>
      </div>
      {feedback && (
        <div
          className={`feedback ${feedback.outcome === "demonstrated" ? "correct" : ""}`}
          role="status"
        >
          <strong>
            {feedback.outcome === "demonstrated"
              ? tr("这次能力得到了证明", "Demonstrated in this task")
              : feedback.outcome === "insufficient"
                ? tr("还需要更多证据", "More evidence is needed")
                : tr("找到一个可以继续的地方", "A useful place to continue")}
          </strong>
          <RichText text={feedback.feedback} />
        </div>
      )}
    </section>
  );
}
function Simulation({ card, tr }: { card: LearningCard; tr: Tr }) {
  const plot = card.plot ?? {
      kind: "linear" as const,
      min: 5,
      max: 20,
      initial: 8,
      label: "条件范围",
    },
    [value, setValue] = useState(plot.initial);
  const width = 480,
    height = 170;
  const normal = (x: number) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
  const points = Array.from({ length: 81 }, (_, i) => {
    const x = (i / 80) * 6 - 3;
    const y =
      plot.kind === "normal"
        ? normal(x / (Math.max(0.2, value) / 5)) * 0.9
        : plot.kind === "quadratic"
          ? Math.pow(i / 80, 2) * (value / plot.max)
          : plot.kind === "compound"
            ? Math.pow(1 + value / 100, i / 8) /
              Math.pow(1 + plot.max / 100, 10)
            : 5 / Math.max(5, value);
    return `${25 + (i / 80) * (width - 50)},${height - 20 - Math.min(1, y) * (height - 40)}`;
  }).join(" ");
  return (
    <section className="simulation">
      <div className="simulation-top">
        <span className="soft-tag">
          {tr("动手探索", "Explore the relationship")}
        </span>
        <span>
          {tr(
            "改变参数，观察关系",
            "Change a parameter, observe the relationship",
          )}
        </span>
      </div>
      <h3>{card.title}</h3>
      <RichText text={card.body} />
      {plot.kind === "linear" ? (
        <div className="people-grid">
          {Array.from({ length: 20 }, (_, i) => (
            <span
              key={i}
              className={
                i < 5
                  ? "person target"
                  : i < value
                    ? "person condition"
                    : "person"
              }
              aria-hidden="true"
            >
              ●
            </span>
          ))}
          <div>
            <strong>5 / {Math.round(value)}</strong>
            <small>{((5 / value) * 100).toFixed(1)}%</small>
          </div>
        </div>
      ) : (
        <svg
          className="plot"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={card.title}
        >
          <path
            d={`M25 15V${height - 20}H${width - 10}`}
            fill="none"
            stroke="#a7b7ad"
          />
          <polyline
            points={points}
            fill="none"
            stroke="#37695d"
            strokeWidth="3"
          />
        </svg>
      )}
      <label className="slider-label">
        <span>{plot.label}</span>
        <strong>{value}</strong>
      </label>
      <input
        type="range"
        min={plot.min}
        max={plot.max}
        step={plot.max - plot.min > 10 ? 1 : 0.1}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        aria-label={plot.label}
      />
      <div className="legend">
        <span>
          <i className="legend-target" />
          {tr("同时满足两件事", "Both events")}
        </span>
        <span>
          <i className="legend-condition" />
          {tr("满足已知条件", "Given condition")}
        </span>
        <span>
          <i />
          {tr("范围之外", "Outside the condition")}
        </span>
      </div>
    </section>
  );
}
