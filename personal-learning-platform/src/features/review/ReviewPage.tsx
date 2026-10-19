import { CalendarClock } from "lucide-react";
import { useI18n } from "../../app/i18n";
import { useLearning } from "../../app/store";
import { reviews } from "../../lib/plan";
import { daysFrom } from "../../lib/format";
import { Empty, Page } from "../../ui/primitives";
import { ReviewRow } from "../today/TodayPage";
import { policy } from "../../../shared/core";

export function ReviewPage() {
  const { tr } = useI18n();
  const L = useLearning();
  const all = reviews(L.courses);
  const groups: { title: string; items: typeof all }[] = [
    {
      title: tr("已到期", "Due now"),
      items: all.filter((r) => daysFrom(r.due) <= 0),
    },
    {
      title: tr("未来 7 天", "Next 7 days"),
      items: all.filter((r) => daysFrom(r.due) > 0 && daysFrom(r.due) <= 7),
    },
    {
      title: tr("之后", "Later"),
      items: all.filter((r) => daysFrom(r.due) > 7),
    },
  ];
  return (
    <Page
      title={tr("复习，让理解留下来", "Review, so understanding stays")}
      lead={tr(
        "间隔之后用没见过的新题再做一次，才能区分熟悉感和真正的保持。先修复阻碍当前理解的缺口，再做到期复习；不必补完所有旧任务。",
        "A fresh attempt after a gap separates familiarity from retention. Repair blocking gaps first, then do what is due — no need to clear every old task.",
      )}
    >
      <div
        className="interval-strip"
        aria-label={tr("复习间隔", "Review intervals")}
      >
        {policy.mastery.reviewIntervalsDays.map((d, i) => (
          <span key={d}>
            <i aria-hidden="true" />
            {tr(`第 ${i + 1} 次 · ${d} 天`, `Review ${i + 1} · ${d} days`)}
          </span>
        ))}
      </div>
      {all.length ? (
        groups
          .filter((g) => g.items.length)
          .map((g) => (
            <section className="section" key={g.title}>
              <div className="section-heading">
                <h2>
                  {g.title}
                  <span className="count">{g.items.length}</span>
                </h2>
              </div>
              <ul className="rows">
                {g.items.map((r) => (
                  <ReviewRow key={`${r.course.id}:${r.concept.id}`} item={r} />
                ))}
              </ul>
            </section>
          ))
      ) : (
        <Empty
          icon={CalendarClock}
          title={tr("复习会随学习证据生成", "Reviews grow from your evidence")}
          text={tr(
            "完成一次独立作答后，系统会安排下一次间隔复习。",
            "After an independent attempt, the next spaced review appears here.",
          )}
        />
      )}
    </Page>
  );
}
