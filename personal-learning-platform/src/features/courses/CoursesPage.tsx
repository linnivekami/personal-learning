import { useState } from "react";
import { ArrowUpRight, CalendarClock, Plus } from "lucide-react";
import { useI18n } from "../../app/i18n";
import { useLearning } from "../../app/store";
import { Link } from "../../app/router";
import { Page, Pill } from "../../ui/primitives";
import { CourseCode, CourseLine } from "../../ui/CourseLine";
import { verifiedCount } from "../../lib/mastery";
import { reviews } from "../../lib/plan";
import { daysFrom } from "../../lib/format";
import { sampleCourse } from "../../../shared/sample";
import { CreateCourse, goals, useSaveSample } from "./CreateCourse";

export function CoursesPage() {
  const { tr } = useI18n();
  const L = useLearning();
  const [creating, setCreating] = useState(false);
  const saveSample = useSaveSample();
  const due = reviews(L.courses).filter((r) => daysFrom(r.due) <= 0);
  return (
    <Page
      title={tr("我的课程", "My courses")}
      lead={tr(
        "每门课是一条学习线路：知识点是站点，先修关系是换乘。",
        "Each course is a learning line: concepts are stations, prerequisites are transfers.",
      )}
      action={
        <button
          className="button"
          onClick={() => (L.user ? setCreating(true) : L.openLogin())}
        >
          <Plus size={17} aria-hidden="true" />
          {tr("新建课程", "New course")}
        </button>
      }
    >
      <ul className="course-grid">
        {L.courses.map((c) => {
          const dueHere = due.filter((d) => d.course.id === c.id).length;
          return (
            <li key={c.id}>
              <Link
                to={{ name: "learn", courseId: c.id }}
                className="course-card"
                onClick={() => L.selectCourse(c.id)}
              >
                <div className="course-card-head">
                  <CourseCode course={c} />
                  <Pill>{tr(...goals[c.goal])}</Pill>
                  {c.examDate && <Pill tone="warn">{c.examDate}</Pill>}
                </div>
                <h2>{c.title}</h2>
                <p>
                  {c.description ||
                    tr("还没有课程说明。", "No description yet.")}
                </p>
                <CourseLine course={c} max={12} />
                <footer>
                  <span>
                    {tr(
                      `${verifiedCount(c)} / ${c.concepts.length} 已验证`,
                      `${verifiedCount(c)} / ${c.concepts.length} verified`,
                    )}
                  </span>
                  {dueHere > 0 && (
                    <span className="due overdue">
                      <CalendarClock size={14} aria-hidden="true" />
                      {tr(`${dueHere} 项到期`, `${dueHere} due`)}
                    </span>
                  )}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </footer>
              </Link>
            </li>
          );
        })}
        <li>
          <div className="course-card sample">
            <div className="course-card-head">
              <CourseCode course={sampleCourse} />
              <Pill tone="signal">{tr("内置示例", "Built-in sample")}</Pill>
            </div>
            <h2>{sampleCourse.title}</h2>
            <p>{sampleCourse.description}</p>
            <CourseLine
              course={sampleCourse}
              max={12}
              highlight="conditional"
            />
            <footer className="button-row">
              <Link
                to={{ name: "learn", courseId: sampleCourse.id }}
                className="button secondary small"
              >
                {tr("浏览示例", "Browse")}
              </Link>
              <button
                className="button small"
                onClick={() => void saveSample()}
              >
                {tr("保存为我的课程", "Make it mine")}
              </button>
            </footer>
          </div>
        </li>
      </ul>
      {creating && <CreateCourse onClose={() => setCreating(false)} />}
    </Page>
  );
}
