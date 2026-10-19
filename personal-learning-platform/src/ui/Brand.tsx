// The Personal Learning mark, drawn in Pathline's construction: one even
// line (here an L for Learning) that turns once and stops in a signal-yellow
// terminus. The line follows currentColor; only the terminus is yellow.
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M14 6v24a6 6 0 0 0 6 6h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
      />
      <circle
        cx="34"
        cy="36"
        r="6.4"
        fill="#FFC72C"
        stroke="currentColor"
        strokeWidth="2.25"
      />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <BrandMark />
      {!compact && (
        <span className="brand-words">
          <span className="brand-name">Personal Learning</span>
          <span className="brand-tag">Pathline</span>
        </span>
      )}
    </span>
  );
}
