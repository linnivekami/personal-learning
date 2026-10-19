import { useLayoutEffect, useRef, type CSSProperties } from "react";
import type {
  CheatSheetOptions,
  CheatSheetPage as SheetPageData,
  CheatTopic,
} from "../../../shared/cheatsheet";
import { CheatText } from "./CheatText";

export const MM_TO_PX = 96 / 25.4;
export const SHEET_WIDTH_MM = 210;
/** Slightly under 297mm so browser rounding can never create a third page. */
export const SHEET_HEIGHT_MM = 296.9;
export const SHEET_WIDTH_PX = SHEET_WIDTH_MM * MM_TO_PX;
export const SHEET_HEIGHT_PX = SHEET_HEIGHT_MM * MM_TO_PX;

const BASE_FONT_PT = 6.8;
const MIN_FONT_PT = 4.2;
const MAX_FONT_PT = BASE_FONT_PT * 1.35;

const gapFor = (fontPt: number) => fontPt * (96 / 72) * 0.3;

function Topic({
  topic,
  options,
}: {
  topic: CheatTopic;
  options: CheatSheetOptions;
}) {
  return (
    <article className="cs-topic">
      <div className="cs-topic-head">
        <span className="cs-code">{topic.code}</span>
        <span className="cs-title">{topic.title}</span>
      </div>
      <div className="cs-body">
        <CheatText text={topic.body} />
      </div>
      {topic.formulas.length > 0 && (
        <div
          className={`cs-formulas ${options.highlightFormulas ? "hl" : ""}`}
        >
          {topic.formulas.map((formula, index) => (
            <div className="cs-formula" key={index}>
              <CheatText text={formula} />
            </div>
          ))}
        </div>
      )}
      {topic.pitfalls.length > 0 && (
        <div
          className={`cs-pitfalls ${options.highlightMistakes ? "hl" : ""}`}
        >
          {topic.pitfalls.map((pitfall, index) => (
            <div className="cs-pitfall" key={index}>
              <span className="cs-trap" aria-hidden="true">
                !
              </span>
              <span className="cs-trap-text">
                <CheatText text={pitfall} />
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

/**
 * One physical A4 side. Each column independently finds the largest font that
 * fits, then all columns share the smallest of those sizes. Leftover height is
 * spent on the gaps between boxes, so the page reads as a filled sheet rather
 * than a few cards floating in white space.
 */
export function SheetPageView({
  page,
  index,
  options,
}: {
  page: SheetPageData;
  index: number;
  options: CheatSheetOptions;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const columns = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    let cancelled = false;
    const fit = () => {
      if (cancelled) return;
      const pageElement = pageRef.current;
      const columnElements = columns.current.filter(
        (element): element is HTMLDivElement => !!element,
      );
      if (!pageElement || !columnElements.length) return;
      const available = columnElements[0].clientHeight;
      if (available < 80) return;

      const inners = columnElements.map(
        (column) =>
          column.querySelector<HTMLDivElement>(".cs-col-inner") ?? null,
      );
      const apply = (font: number, extra: number[] = []) => {
        inners.forEach((inner, index) => {
          if (!inner) return;
          inner.style.fontSize = `${font}pt`;
          inner.style.gap = `${gapFor(font) + (extra[index] ?? 0)}px`;
        });
      };

      let common = MAX_FONT_PT;
      inners.forEach((inner) => {
        if (!inner) return;
        let low = MIN_FONT_PT;
        let high = MAX_FONT_PT;
        for (let step = 0; step < 9; step++) {
          const middle = (low + high) / 2;
          inner.style.fontSize = `${middle}pt`;
          inner.style.gap = `${gapFor(middle)}px`;
          if (inner.scrollHeight <= available) low = middle;
          else high = middle;
        }
        common = Math.min(common, low);
      });
      common = Math.max(MIN_FONT_PT, common);
      apply(common);

      // Guard against a one-pixel rounding overflow after the shared size.
      let guard = 0;
      while (
        inners.some((inner) => inner && inner.scrollHeight > available + 1) &&
        common > MIN_FONT_PT &&
        guard++ < 14
      ) {
        common -= 0.08;
        apply(common);
      }

      const extra = inners.map((inner) => {
        if (!inner) return 0;
        const topics = inner.querySelectorAll(".cs-topic").length;
        if (topics < 2) return 0;
        const leftover = available - inner.scrollHeight;
        return Math.max(0, Math.min(2.2 * MM_TO_PX, leftover / (topics - 1)));
      });
      apply(common, extra);
    };

    fit();
    const frame = requestAnimationFrame(fit);
    const onFonts = () => {
      if (!cancelled) fit();
    };
    if (document.fonts?.ready) void document.fonts.ready.then(onFonts);
    window.addEventListener("beforeprint", fit);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => fit());
    if (observer && pageRef.current) observer.observe(pageRef.current);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("beforeprint", fit);
      observer?.disconnect();
    };
    // The rendered page is the dependency that matters; options change line
    // breaks inside formulas and pitfalls, so they must refit too.
  }, [page, options]);

  return (
    <div
      className="cs-page"
      ref={pageRef}
      data-side={index === 0 ? "front" : "back"}
      aria-label={`A4 ${index === 0 ? "front" : "back"}`}
    >
      {page.columns.map((topics, columnIndex) => (
        <div
          className="cs-col"
          key={columnIndex}
          ref={(element) => {
            columns.current[columnIndex] = element;
          }}
          style={{ "--cs-col": columnIndex } as CSSProperties}
        >
          <div className="cs-col-inner">
            {topics.map((topic, topicIndex) => (
              <Topic
                key={`${topic.code}-${topicIndex}`}
                topic={topic}
                options={options}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
