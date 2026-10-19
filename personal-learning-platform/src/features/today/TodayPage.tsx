import { useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Clock3,
  Flame,
  Library,
  LogIn,
  Plus,
  Route as RouteIcon,
  Target,
} from "lucide-react";
import { useI18n } from "../../app/i18n";
import { useLearning } from "../../app/store";
import { Link, navigate } from "../../app/router";
import { nextStep, reviews } from "../../lib/plan";
import { daysFrom, dueLabel, todayLine } from "../../lib/format";
import { levelName, masteryOf, verifiedCount } from "../../lib/mastery";
import { Empty, Page, Pill, Spinner, Station } from "../../ui/primitives";
import { CourseCode, CourseLine } from "../../ui/CourseLine";
import { sampleCourse } from "../../../shared/sample";
import { CreateCourse, useSaveSample } from "../courses/CreateCourse";
import { policy } from "../../../shared/core";

const kindLabel: Record<string, [string, string]> = {
  review: ["间隔复习", "Spaced review"],
  diagnose: ["修复障碍", "Repair a gap"],
  explain: ["建立框架", "Build the frame"],
  practice: ["独立练习", "Independent practice"],
  transfer: ["新情境应用", "Apply somewhere new"],
};

export function TodayPage() {
  const { tr, language } = useI18n();
  const L = useLearning();
  const [creating, setCreating] = useState(false);
  const saveSample = useSaveSample();
  if (!L.ready)
    return (
      <Page title={tr("今天", "Today")}>
        <Spinner />
      </Page>
    );
  if (!L.user) return <Welcome />;
  const step = nextStep(L.courses);
  const all = reviews(L.courses);
  const due = all.filter((r) => daysFrom(r.due) <= 0);
  const soon = all.filter((r) => daysFrom(r.due) > 0).slice(0, 5);
  const week = L.rewards?.challenges;
  const hour = new Date().getHours();
  const greeting =
    hour < 11
      ? tr("早上好", "Good morning")
      : hour < 18
        ? tr("下午好", "Good afternoon")
        : tr("晚上好", "Good evening");
  return (
    <Page
      eyebrow={todayLine(language)}
      title={
        language === "zh"
          ? `${greeting}，${L.user.name}`
          : `${greeting}, ${L.user.name}`
      }
      lead={tr(
        "今天只需要一个小步。完成它，系统会按证据安排下一个。",
        "Today needs only one small step. Finish it and the evidence decides the next.",
      )}
    >
      <div className="today-grid">
        <section className="next-step" aria-labelledby="next-step-title">
          <div className="section-kicker">
            <Target size={16} aria-hidden="true" />
            <span id="next-step-title">
              {tr("下一小步", "Your next small step")}
            </span>
          </div>
          {step ? (
            <>
              <div className="next-step-line">
                <Station
                  level={masteryOf(step.course, step.action.conceptId)}
                  next
                  size={22}
                />
                <div>
                  <Pill tone="signal">
                    {tr(...kindLabel[step.action.kind])}
                  </Pill>
                  <h2>
                    {step.course.concepts.find(
                      (c) => c.id === step.action.conceptId,
                    )?.title ?? step.action.title}
                  </h2>
                  <p>{step.action.reason}</p>
                  <div className="next-step-meta">
                    <span>
                      <CourseCode course={step.course} />
                      {step.course.title}
                    </span>
                    <span>
                      <Clock3 size={14} aria-hidden="true" />
                      {tr(
                        `约 ${step.action.estimatedMinutes} 分钟`,
                        `About ${step.action.estimatedMinutes} min`,
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <button
                className="button"
                onClick={() => {
                  L.selectCourse(step.course.id);
                  navigate({
                    name: "learn",
                    courseId: step.course.id,
                    conceptId: step.action.conceptId,
                  });
                }}
              >
                {tr("开始这一步", "Start this step")}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </>
          ) : (
            <Empty
              icon={RouteIcon}
              title={tr(
                "先铺一条学习线路",
                "Lay down your first learning line",
              )}
              text={tr(
                "新建一门课程，或把示例课程保存为自己的，从第一站开始积累证据。",
                "Create a course, or save the sample as yours, and start collecting evidence at the first station.",
              )}
              action={
                <div className="button-row">
                  <button className="button" onClick={() => setCreating(true)}>
                    <Plus size={16} aria-hidden="true" />
                    {tr("新建课程", "New course")}
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => void saveSample()}
                  >
                    {tr("保存示例课程", "Save the sample course")}
                  </button>
                </div>
              }
            />
          )}
        </section>
        <aside className="today-side" aria-label={tr("本周节奏", "This week")}>
          <div className="stat">
            <Flame size={18} aria-hidden="true" />
            <strong>{L.rewards?.streak ?? 0}</strong>
            <span>{tr("天连续学习", "day streak")}</span>
          </div>
          <div className="stat">
            <CalendarClock size={18} aria-hidden="true" />
            <strong>
              {week?.weeklyProgress ?? 0}
              <small>/{week?.weeklyGoal ?? L.reminders.weeklyGoal}</small>
            </strong>
            <span>{tr("本周学习天数", "learning days this week")}</span>
          </div>
          <div className="week-track" aria-hidden="true">
            {Array.from({ length: week?.weeklyGoal ?? 5 }, (_, i) => (
              <i
                key={i}
                className={i < (week?.weeklyProgress ?? 0) ? "on" : ""}
              />
            ))}
          </div>
          <p className="muted small">
            {tr(
              "作答、复测或写一次自主总结，会点亮这一天。断了也没关系，随时继续。",
              "An attempt, a retest or a written reflection lights up the day. Breaks are fine; just continue.",
            )}
          </p>
        </aside>
      </div>

      <section className="section" aria-labelledby="due-title">
        <div className="section-heading">
          <h2 id="due-title">
            {tr("到期复习", "Due for review")}
            {due.length > 0 && <span className="count">{due.length}</span>}
          </h2>
          <Link to={{ name: "review" }} className="text-link">
            {tr("全部复习计划", "Full review plan")}
          </Link>
        </div>
        {due.length ? (
          <ul className="rows">
            {due.slice(0, 6).map((r) => (
              <ReviewRow key={`${r.course.id}:${r.concept.id}`} item={r} />
            ))}
          </ul>
        ) : (
          <p className="muted">
            {soon.length
              ? tr(
                  `今天没有到期的复习。下一次：${soon[0].concept.title}，${dueLabel(soon[0].due, tr, language)}。`,
                  `Nothing due today. Next: ${soon[0].concept.title}, ${dueLabel(soon[0].due, tr, language)}.`,
                )
              : tr(
                  `完成独立作答后，系统会按 ${policy.mastery.reviewIntervalsDays.join(" / ")} 天安排间隔复习。`,
                  `After independent attempts, reviews are spaced at ${policy.mastery.reviewIntervalsDays.join(" / ")} days.`,
                )}
          </p>
        )}
      </section>

      <section className="section" aria-labelledby="lines-title">
        <div className="section-heading">
          <h2 id="lines-title">{tr("我的学习线路", "My learning lines")}</h2>
          <Link to={{ name: "courses" }} className="text-link">
            {tr("管理课程", "Manage courses")}
          </Link>
        </div>
        {L.courses.length ? (
          <ul className="line-list">
            {L.courses.map((c) => (
              <li key={c.id}>
                <Link
                  to={{ name: "learn", courseId: c.id }}
                  className="line-card"
                  onClick={() => L.selectCourse(c.id)}
                >
                  <div className="line-card-head">
                    <CourseCode course={c} />
                    <strong>{c.title}</strong>
                    <span className="muted small">
                      {tr(
                        `${verifiedCount(c)} / ${c.concepts.length} 已验证`,
                        `${verifiedCount(c)} / ${c.concepts.length} verified`,
                      )}
                    </span>
                  </div>
                  <CourseLine course={c} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            icon={Library}
            title={tr("还没有自己的课程", "No courses of your own yet")}
            text={tr(
              "一门课就是一条线路：知识点是站点，掌握度决定你走到了哪一站。",
              "Each course is a line: concepts are stations, and mastery shows how far you have travelled.",
            )}
          />
        )}
      </section>
      {creating && <CreateCourse onClose={() => setCreating(false)} />}
    </Page>
  );
}

function ReviewRow({ item }: { item: ReturnType<typeof reviews>[number] }) {
  const { tr, language } = useI18n();
  const L = useLearning();
  const overdue = daysFrom(item.due) < 0;
  return (
    <li>
      <Link
        to={{
          name: "learn",
          courseId: item.course.id,
          conceptId: item.concept.id,
        }}
        className="row-link"
        onClick={() => L.selectCourse(item.course.id)}
      >
        <Station level={item.mastery} size={16} />
        <span className="row-main">
          <strong>{item.concept.title}</strong>
          <small>
            {item.course.title} · {levelName(item.mastery, tr)}
          </small>
        </span>
        <span className={overdue ? "due overdue" : "due"}>
          {dueLabel(item.due, tr, language)}
        </span>
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </li>
  );
}
export { ReviewRow };

function Welcome() {
  const { tr } = useI18n();
  const L = useLearning();
  const pathline = L.config?.services.pathline;
  return (
    <main className="page welcome" id="main">
      <section className="welcome-hero">
        <div className="eyebrow">Personal Learning · Pathline</div>
        <h1>
          {tr("把零散知识，", "Turn scattered knowledge")}
          <br />
          <span className="signal-plate">
            {tr("学成自己的结构", "into your own structure")}
          </span>
        </h1>
        <p className="page-lead">
          {tr(
            "用知识框架组织讲解，用学习证据安排下一步和复习。看过、听懂都不算掌握——独立做到、间隔之后仍然做得到，才算。",
            "A framework organises the teaching; evidence decides your next step and reviews. Reading and nodding along are not mastery — doing it yourself, and still doing it days later, is.",
          )}
        </p>
        <div className="button-row">
          <button className="button" onClick={L.openLogin}>
            <LogIn size={17} aria-hidden="true" />
            {pathline
              ? tr("使用 Pathline 账号登录", "Sign in with Pathline")
              : tr("登录", "Sign in")}
          </button>
          <Link
            to={{ name: "learn", courseId: sampleCourse.id }}
            className="button secondary"
          >
            {tr("先看示例课程", "Explore the sample course")}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <ol className="principles" aria-label={tr("学习方式", "How it works")}>
        <li>
          <Station level={2} size={20} label={false} />
          <div>
            <strong>{tr("证据驱动的掌握度", "Mastery from evidence")}</strong>
            <p>
              {tr(
                "0–5 级累积门槛：第一次无提示做对才到 2，间隔 2 天以上复测仍然做对才到 3。",
                "Cumulative levels 0–5: a first unassisted success reaches 2; passing again after 2+ days reaches 3.",
              )}
            </p>
          </div>
        </li>
        <li>
          <Station level={0} next size={20} label={false} />
          <div>
            <strong>{tr("永远只有一个下一步", "Always one next step")}</strong>
            <p>
              {tr(
                "5–15 分钟就能开始。中断几天，回来说“继续”就好。",
                "Something you can start in 5–15 minutes. Away for days? Just continue.",
              )}
            </p>
          </div>
        </li>
        <li>
          <Station level={5} size={20} label={false} />
          <div>
            <strong>{tr("让理解留下来", "Make understanding stay")}</strong>
            <p>
              {tr(
                "按 3 / 7 / 14 / 30 天安排复习，用没见过的新题确认保持，而不是重读笔记。",
                "Reviews at 3 / 7 / 14 / 30 days use fresh questions to confirm retention, not rereading.",
              )}
            </p>
          </div>
        </li>
      </ol>
      <section className="welcome-sample">
        <div>
          <div className="eyebrow">{tr("示例课程", "Sample course")}</div>
          <h2>{sampleCourse.title}</h2>
          <p className="muted">{sampleCourse.description}</p>
        </div>
        <CourseLine course={sampleCourse} highlight="conditional" />
        <Link
          to={{ name: "learn", courseId: sampleCourse.id }}
          className="text-link"
        >
          {tr("打开示例：条件概率", "Open the sample: conditional probability")}
        </Link>
      </section>
    </main>
  );
}
