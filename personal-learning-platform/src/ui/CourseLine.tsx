import type { Course } from "../../shared/types";
import { layoutLines } from "../lib/plan";
import { masteryOf } from "../lib/mastery";
import { Station } from "./primitives";
import { useI18n } from "../app/i18n";
import { courseCode } from "../lib/format";

/** A course as one line of stations, in prerequisite order. */
export function CourseLine({
  course,
  max = 14,
  highlight,
}: {
  course: Course;
  max?: number;
  highlight?: string | null;
}) {
  const { tr } = useI18n();
  const order = layoutLines(course.concepts)
    .nodes.slice()
    .sort((a, b) => a.layer - b.layer || a.row - b.row)
    .map((n) => n.concept);
  const shown = order.slice(0, max);
  const next = highlight ?? course.state.nextAction?.conceptId;
  if (!shown.length)
    return (
      <div className="course-line empty">
        <span>{tr("还没有知识点", "No concepts yet")}</span>
      </div>
    );
  return (
    <ol className="course-line" aria-label={tr("知识点线路", "Concept line")}>
      {shown.map((c) => (
        <li key={c.id} title={c.title}>
          <Station
            level={masteryOf(course, c.id)}
            next={c.id === next}
            size={14}
          />
          <span className="visually-hidden">{c.title}</span>
        </li>
      ))}
      {order.length > max && <li className="more">+{order.length - max}</li>}
    </ol>
  );
}

export function CourseCode({ course }: { course: Course }) {
  return (
    <span className="course-code" aria-hidden="true">
      {courseCode(course.title)}
    </span>
  );
}
