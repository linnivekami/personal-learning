import { useState } from "react";
import { Plus } from "lucide-react";
import type { Course, Goal, Strategy } from "../../../shared/types";
import { useI18n } from "../../app/i18n";
import { useLearning } from "../../app/store";
import { navigate } from "../../app/router";
import { post } from "../../lib/api";
import { Modal, Notice, Spinner } from "../../ui/primitives";

export const goals: Record<Goal, [string, string]> = {
  mastery: ["长期掌握", "Lasting mastery"],
  exam: ["考试冲刺", "Exam preparation"],
  habit: ["习惯养成", "Build a habit"],
};
export const strategies: Record<Strategy, [string, string]> = {
  framework: ["框架先行", "Framework first"],
  example: ["案例先行", "Example first"],
  diagnostic: ["诊断先行", "Diagnosis first"],
};

/** Copies the built-in sample into the learner's own account. */
export function useSaveSample() {
  const L = useLearning();
  return async () => {
    if (!L.user) {
      L.openLogin();
      return;
    }
    try {
      const r = await post<{ course: Course }>("/courses/sample", {});
      await L.refresh();
      L.selectCourse(r.course.id);
      navigate({
        name: "learn",
        courseId: r.course.id,
        conceptId: "conditional",
      });
    } catch (e) {
      L.notify(e instanceof Error ? e.message : String(e));
    }
  };
}

export function CreateCourse({ onClose }: { onClose: () => void }) {
  const { tr } = useI18n();
  const L = useLearning();
  const ai = !!L.config?.services.model;
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [goal, setGoal] = useState<Goal>("mastery"),
    [strategy, setStrategy] = useState<Strategy>("framework"),
    [language, setLanguage] = useState("mixed"),
    [examDate, setExamDate] = useState(""),
    [generate, setGenerate] = useState(ai),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title={tr("你想把什么学明白？", "What do you want to understand?")}
      onClose={onClose}
    >
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await post<{ course: Course }>("/courses", {
              title,
              description,
              goal,
              strategy,
              language,
              examDate: examDate || null,
              generate: ai && generate,
            });
            await L.refresh();
            L.selectCourse(r.course.id);
            onClose();
            navigate({ name: "learn", courseId: r.course.id });
          } catch (e) {
            L.notify(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {tr("课程或主题", "Course or topic")}
          <input
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tr(
              "例如：统计推断、运营管理、Python 数据分析",
              "For example: statistical inference, Python data analysis",
            )}
          />
        </label>
        <label>
          {tr("你希望学会什么？", "What do you want to be able to do?")}
          <textarea
            value={description}
            maxLength={3000}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={tr(
              "目标、已有基础，或者正在卡住的地方。",
              "Your goal, background, or where you are stuck.",
            )}
          />
        </label>
        <div className="form-grid">
          <label>
            {tr("学习目标", "Learning goal")}
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as Goal)}
            >
              {Object.entries(goals).map(([id, l]) => (
                <option key={id} value={id}>
                  {tr(...l)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("讲解路径", "Teaching approach")}
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as Strategy)}
            >
              {Object.entries(strategies).map(([id, l]) => (
                <option key={id} value={id}>
                  {tr(...l)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("课程语言", "Course language")}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="mixed">
                {tr("中文讲解 + 英文术语", "Chinese with English terms")}
              </option>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </label>
          {goal === "exam" && (
            <label>
              {tr("考试日期", "Exam date")}
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </label>
          )}
        </div>
        {ai ? (
          <label className="check-label">
            <input
              type="checkbox"
              checked={generate}
              onChange={(e) => setGenerate(e.target.checked)}
            />
            {tr("让 AI 先建立知识框架", "Let AI draft the knowledge framework")}
          </label>
        ) : (
          <Notice>
            {tr(
              "AI 讲解尚未开启：课程会以空框架创建，你可以手动添加知识点，或在资料页上传课件后整理。",
              "AI teaching is not enabled yet: the course starts with an empty framework you can fill by hand.",
            )}
          </Notice>
        )}
        <button className="button full" disabled={busy}>
          {busy ? <Spinner /> : <Plus size={17} aria-hidden="true" />}
          {tr("建立学习线路", "Create the learning line")}
        </button>
      </form>
    </Modal>
  );
}
