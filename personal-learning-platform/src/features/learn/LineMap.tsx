import type { Course } from "../../../shared/types";
import { useI18n } from "../../app/i18n";
import { layoutLines, linePath } from "../../lib/plan";
import { levelName, masteryOf } from "../../lib/mastery";
import { Station } from "../../ui/primitives";

// Breaks a title into at most two short lines under its station.
function label(title: string) {
  const cjk = /[㐀-鿿]/.test(title);
  const max = cjk ? 7 : 14;
  if ([...title].length <= max) return [title];
  if (cjk) {
    const chars = [...title];
    const second = chars.slice(max, max * 2).join("");
    return [
      chars.slice(0, max).join(""),
      chars.length > max * 2 ? `${second.slice(0, -1)}…` : second,
    ];
  }
  const words = title.split(/\s+/);
  const first: string[] = [];
  while (words.length && [...first, words[0]].join(" ").length <= max)
    first.push(words.shift()!);
  const rest = words.join(" ");
  return [
    first.join(" ") || title.slice(0, max),
    rest.length > max ? `${rest.slice(0, max - 1)}…` : rest,
  ].filter(Boolean);
}

/** The course as a transit map: prerequisites flow left to right. */
export function LineMap({
  course,
  selected,
  onSelect,
}: {
  course: Course;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const { tr } = useI18n();
  const { nodes, edges, width, height } = layoutLines(course.concepts);
  const at = new Map(nodes.map((n) => [n.concept.id, n]));
  const next = course.state.nextAction?.conceptId;
  if (!nodes.length)
    return <p className="muted">{tr("还没有知识点。", "No concepts yet.")}</p>;
  return (
    <div className="line-map">
      <p className="muted small">
        {tr(
          "实线是先修关系，虚线是上下级。站点越满，独立证据越充分；黄色是下一站。选择任意站点进入学习。",
          "Solid lines are prerequisites, dashed lines are parent topics. Fuller stations carry more independent evidence; yellow marks the next stop. Choose a station to study it.",
        )}
      </p>
      <div className="line-map-canvas">
        <svg
          viewBox={`0 0 ${Math.max(width, 320)} ${height}`}
          width={Math.max(width, 320)}
          height={height}
          role="group"
          aria-label={tr("知识线路图", "Knowledge line map")}
        >
          {edges.map((e) => {
            const a = at.get(e.from),
              b = at.get(e.to);
            if (!a || !b) return null;
            return (
              <path
                key={`${e.from}>${e.to}`}
                className={`map-edge ${e.kind}`}
                d={linePath(a.x, a.y, b.x, b.y)}
              />
            );
          })}
          {nodes.map((n) => {
            const level = masteryOf(course, n.concept.id);
            const lines = label(n.concept.title);
            return (
              <g
                key={n.concept.id}
                className={`map-node ${selected === n.concept.id ? "selected" : ""}`}
                transform={`translate(${n.x} ${n.y})`}
                role="button"
                tabIndex={0}
                aria-label={`${n.concept.title} · ${levelName(level, tr)}${next === n.concept.id ? ` · ${tr("下一站", "next stop")}` : ""}`}
                onClick={() => onSelect(n.concept.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(n.concept.id);
                  }
                }}
              >
                <rect
                  className="map-hit"
                  x={-60}
                  y={-18}
                  width={120}
                  height={70}
                  rx={6}
                />
                <g transform="translate(-11 -11)">
                  <Station
                    level={level}
                    size={22}
                    next={next === n.concept.id}
                    current={selected === n.concept.id}
                    label={false}
                  />
                </g>
                {lines.map((t, i) => (
                  <text
                    key={i}
                    className="map-label"
                    y={28 + i * 16}
                    textAnchor="middle"
                  >
                    {t}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
