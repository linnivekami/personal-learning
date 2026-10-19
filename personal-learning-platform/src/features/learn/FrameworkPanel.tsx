import { useMemo, useState } from "react";
import {
  ArrowRight,
  Compass,
  Map as MapIcon,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { Concept, Course, Goal } from "../../../shared/types";
import { useI18n } from "../../app/i18n";
import { useLearning } from "../../app/store";
import { Empty, Station } from "../../ui/primitives";
import { CourseCode } from "../../ui/CourseLine";
import { levelName, masteryOf, verifiedCount } from "../../lib/mastery";
import { goals, CreateCourse } from "../courses/CreateCourse";
import { navigate } from "../../app/router";
import { sampleCourse } from "../../../shared/sample";

/** Depth-first order so children sit under their parent on the line. */
function ordered(concepts: Concept[]) {
  const ids = new Set(concepts.map((c) => c.id));
  const children = new Map<string | null, Concept[]>();
  for (const c of concepts) {
    const parent = c.parentId && ids.has(c.parentId) ? c.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), c]);
  }
  const out: { concept: Concept; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    for (const c of children.get(parent) ?? []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push({ concept: c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  for (const c of concepts)
    if (!seen.has(c.id)) out.push({ concept: c, depth: 0 });
  return out;
}

export function FrameworkPanel({
  course,
  sample,
  selected,
  onSelect,
  onMap,
  onEdit,
  onGoal,
}: {
  course: Course;
  sample: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  onMap: () => void;
  onEdit: () => void;
  onGoal: (goal: Goal) => void;
}) {
  const { tr } = useI18n();
  const L = useLearning();
  const [query, setQuery] = useState(""),
    [gaps, setGaps] = useState(false),
    [creating, setCreating] = useState(false);
  const rows = useMemo(() => ordered(course.concepts), [course.concepts]);
  const next = course.state.nextAction;
  const shown = rows.filter(({ concept: n }) => {
    const s = course.state.concepts[n.id];
    const text = `${n.title} ${n.summary}`.toLowerCase();
    return (
      (!query || text.includes(query.toLowerCase())) &&
      (!gaps || !!s?.weaknesses.length || [1, 2].includes(s?.mastery ?? 0))
    );
  });
  const verified = verifiedCount(course);
  return (
    <aside className="framework" aria-label={tr("知识线路", "Knowledge line")}>
      <div className="framework-course">
        <div className="framework-course-row">
          <CourseCode course={course} />
          <label className="visually-hidden" htmlFor="course-switch">
            {tr("选择课程", "Choose course")}
          </label>
          <select
            id="course-switch"
            className="course-switch"
            value={course.id}
            onChange={(e) => {
              if (e.target.value === "__new") {
                if (L.user) setCreating(true);
                else L.openLogin();
                return;
              }
              if (e.target.value !== sampleCourse.id)
                L.selectCourse(e.target.value);
              navigate({ name: "learn", courseId: e.target.value });
            }}
          >
            {L.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
            {(sample || !L.courses.length) && (
              <option value={sampleCourse.id}>
                {sampleCourse.title} · {tr("示例", "Sample")}
              </option>
            )}
            <option value="__new">＋ {tr("新建课程", "New course")}</option>
          </select>
        </div>
        <div className="framework-meta">
          <select
            aria-label={tr("学习目标", "Learning goal")}
            className="chip-select"
            value={course.goal}
            disabled={sample}
            onChange={(e) => onGoal(e.target.value as Goal)}
          >
            {Object.entries(goals).map(([id, l]) => (
              <option key={id} value={id}>
                {tr(...l)}
              </option>
            ))}
          </select>
          <span className="progress-text">
            {tr("已验证", "Verified")} <b>{verified}</b>/
            {course.concepts.length}
          </span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label={tr(
            "已验证掌握的知识点比例",
            "Share of concepts with verified mastery",
          )}
          aria-valuemin={0}
          aria-valuemax={course.concepts.length}
          aria-valuenow={verified}
        >
          <i
            style={{
              width: `${course.concepts.length ? (verified / course.concepts.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>
      <div className="framework-tools">
        <div className="search-field">
          <Search size={15} aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("查找知识点", "Find a concept")}
            aria-label={tr("查找知识点", "Find a concept")}
          />
        </div>
        <div className="chip-row">
          <button
            className={`chip ${gaps ? "on" : ""}`}
            aria-pressed={gaps}
            onClick={() => setGaps(!gaps)}
          >
            {tr("只看薄弱点", "Gaps only")}
          </button>
          <button className="chip" onClick={onMap}>
            <MapIcon size={14} aria-hidden="true" />
            {tr("线路图", "Line map")}
          </button>
          <button
            className="chip icon"
            onClick={onEdit}
            aria-label={tr("编辑知识框架", "Edit framework")}
            title={tr("编辑知识框架", "Edit framework")}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
      <ol className="line-tree" aria-label={tr("知识点", "Concepts")}>
        {shown.map(({ concept: n, depth }) => {
          const level = masteryOf(course, n.id);
          const here = selected === n.id;
          return (
            <li key={n.id} className={`depth-${Math.min(depth, 2)}`}>
              <button
                className={`stop ${here ? "selected" : ""}`}
                aria-current={here ? "true" : undefined}
                onClick={() => onSelect(n.id)}
              >
                <Station
                  level={level}
                  next={next?.conceptId === n.id}
                  size={depth ? 14 : 18}
                  label={false}
                />
                <span className="stop-title">{n.title}</span>
                <span className="visually-hidden">{levelName(level, tr)}</span>
                {next?.conceptId === n.id && (
                  <span className="stop-tag">{tr("下一站", "Next")}</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      {!course.concepts.length && (
        <Empty
          icon={Compass}
          title={tr("线路从第一站开始", "The line starts with one station")}
          text={tr(
            "添加想学的知识点，或上传资料后整理成框架。",
            "Add a concept you want to learn, or organise uploaded materials into a framework.",
          )}
          action={
            <button className="button small" onClick={onEdit}>
              <Plus size={15} aria-hidden="true" />
              {tr("添加知识点", "Add a concept")}
            </button>
          }
        />
      )}
      <div className="legend" aria-label={tr("图例", "Legend")}>
        {[0, 1, 2, 3, 5].map((l) => (
          <span key={l}>
            <Station level={l} size={12} label={false} />
            {levelName(l, tr)}
          </span>
        ))}
      </div>
      {next && (
        <button className="next-mini" onClick={() => onSelect(next.conceptId)}>
          <span className="section-kicker">
            <Compass size={14} aria-hidden="true" />
            {tr("下一小步", "Next small step")}
          </span>
          <strong>{next.title}</strong>
          <small>{next.reason}</small>
          <span className="text-link">
            {tr("从这里继续", "Continue here")}
            <ArrowRight size={14} aria-hidden="true" />
          </span>
        </button>
      )}
      {creating && <CreateCourse onClose={() => setCreating(false)} />}
    </aside>
  );
}
