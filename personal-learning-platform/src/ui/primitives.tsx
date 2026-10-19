import { useEffect, useRef, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { useI18n } from "../app/i18n";
import { levelName } from "../lib/mastery";

export function Modal({
  title,
  onClose,
  children,
  size = "normal",
  side = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: "normal" | "wide";
  /** Open as a sheet from the right edge on wide screens. */
  side?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { tr } = useI18n();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${size} ${side ? "side" : ""}`}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={tr("关闭", "Close")}
        >
          <X size={20} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}

export function Page({
  title,
  lead,
  eyebrow,
  action,
  children,
  wide = false,
}: {
  title: string;
  lead?: string;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className={`page ${wide ? "wide" : ""}`} id="main">
      <header className="page-heading">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1>{title}</h1>
          {lead && <p className="page-lead">{lead}</p>}
        </div>
        {action && <div className="page-action">{action}</div>}
      </header>
      {children}
    </main>
  );
}

export function Empty({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon size={30} strokeWidth={1.5} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

/**
 * A concept as a station. Shape carries the level (hollow → half → full →
 * ringed → terminus), so the state never depends on colour alone.
 */
export function Station({
  level,
  current = false,
  next = false,
  size = 16,
  label = true,
}: {
  level: number;
  current?: boolean;
  next?: boolean;
  size?: number;
  label?: boolean;
}) {
  const { tr } = useI18n();
  const r = size / 2 - 1.5;
  const c = size / 2;
  return (
    <svg
      className={`station level-${level} ${current ? "current" : ""} ${next ? "next" : ""}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role={label ? "img" : undefined}
      aria-label={label ? levelName(level, tr) : undefined}
      aria-hidden={label ? undefined : true}
    >
      <circle className="station-ring" cx={c} cy={c} r={r} />
      {level === 1 && (
        <circle className="station-fill" cx={c} cy={c} r={r * 0.32} />
      )}
      {level === 2 && (
        <path
          className="station-fill"
          d={`M${c} ${c - r} A${r} ${r} 0 0 1 ${c} ${c + r} Z`}
        />
      )}
      {level >= 3 && <circle className="station-fill" cx={c} cy={c} r={r} />}
      {level >= 4 && (
        <circle className="station-inner" cx={c} cy={c} r={r * 0.55} />
      )}
      {level === 5 && (
        <circle className="station-terminus" cx={c} cy={c} r={r * 0.36} />
      )}
    </svg>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "signal" | "trust" | "warn" | "danger" | "route";
}) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Notice({
  children,
  tone = "neutral",
  icon: Icon,
}: {
  children: ReactNode;
  tone?: "neutral" | "trust" | "warn" | "danger" | "signal";
  icon?: LucideIcon;
}) {
  return (
    <div className={`notice ${tone}`} role="note">
      {Icon && <Icon size={18} aria-hidden="true" />}
      <div>{children}</div>
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
