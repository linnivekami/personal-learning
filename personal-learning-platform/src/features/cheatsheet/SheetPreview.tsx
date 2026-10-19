import { useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus, Printer } from "lucide-react";
import type {
  CheatSheet,
  CheatSheetOptions,
} from "../../../shared/cheatsheet";
import { useI18n } from "../../app/i18n";
import { shortDate } from "../../lib/format";
import {
  SHEET_HEIGHT_PX,
  SHEET_WIDTH_PX,
  SheetPageView,
} from "./SheetPage";

const PAGE_GAP = 20;

export function SheetPreview({
  sheet,
  options,
}: {
  sheet: CheatSheet;
  options: CheatSheetOptions;
}) {
  const { tr, language } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);

  useEffect(() => {
    if (!fitWidth) return;
    const host = hostRef.current;
    if (!host) return;
    const update = () => {
      const width = host.clientWidth - 8;
      if (width > 0)
        setZoom(Math.max(0.3, Math.min(1, width / SHEET_WIDTH_PX)));
    };
    update();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(update);
    observer?.observe(host);
    return () => observer?.disconnect();
  }, [fitWidth]);

  const unscaledHeight = SHEET_HEIGHT_PX * 2 + PAGE_GAP;
  const zoomBy = (delta: number) => {
    setFitWidth(false);
    setZoom((value) =>
      Math.max(0.3, Math.min(1.4, Math.round((value + delta) * 100) / 100)),
    );
  };
  const fit = () => {
    const host = hostRef.current;
    if (host) {
      setZoom(
        Math.max(0.3, Math.min(1, (host.clientWidth - 8) / SHEET_WIDTH_PX)),
      );
    }
    setFitWidth(true);
  };
  const print = () => {
    const previous = document.title;
    document.title = `${sheet.title} · ${tr("速查表", "Cheat sheet")}`;
    const restore = () => {
      document.title = previous;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  return (
    <section className="cs-preview" aria-label={tr("速查表预览", "Cheat sheet preview")}>
      <div className="cs-toolbar">
        <div className="cs-toolbar-title">
          <strong>{sheet.title}</strong>
          <small>
            {sheet.subtitle} · {shortDate(sheet.createdAt, language)}
          </small>
        </div>
        <div className="cs-toolbar-actions">
          <div className="cs-zoom" role="group" aria-label={tr("缩放", "Zoom")}>
            <button
              className="icon-button"
              onClick={() => zoomBy(-0.1)}
              aria-label={tr("缩小", "Zoom out")}
            >
              <Minus size={15} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              className="icon-button"
              onClick={() => zoomBy(0.1)}
              aria-label={tr("放大", "Zoom in")}
            >
              <Plus size={15} />
            </button>
            <button
              className={`icon-button ${fitWidth ? "active" : ""}`}
              onClick={fit}
              aria-label={tr("适应宽度", "Fit width")}
              title={tr("适应宽度", "Fit width")}
            >
              <Maximize2 size={15} />
            </button>
          </div>
          <button className="button small" onClick={print}>
            <Printer size={16} aria-hidden="true" />
            {tr("打印 / 存为 PDF", "Print / Save PDF")}
          </button>
        </div>
      </div>
      <div className="cs-preview-scroll" ref={hostRef}>
        <div
          className="cs-scaler"
          style={{ width: SHEET_WIDTH_PX * zoom, height: unscaledHeight * zoom }}
        >
          <div
            className="cs-scaler-inner"
            style={{
              width: SHEET_WIDTH_PX,
              transform: `scale(${zoom})`,
            }}
          >
            {sheet.pages.map((page, index) => (
              <div className="cs-page-slot" key={index}>
                <SheetPageView page={page} index={index} options={options} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="cs-print-note">
        {tr(
          "打印设置：A4 纵向 · 100% · 页边距「无」· 开启背景图形。两页分别为正面与反面。",
          "Print settings: A4 portrait · 100% · margins “None” · background graphics on. Page 1 is the front, page 2 the back.",
        )}
      </p>
    </section>
  );
}
