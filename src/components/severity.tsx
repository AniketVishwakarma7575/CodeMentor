import * as React from "react";
import type { Severity } from "@/lib/types";
import { cn, severityMeta, severityVar } from "@/lib/utils";

/* ============================================================================
   Severity is encoded on THREE channels, always:
       colour  +  shape  +  written label
   Remove the colour channel entirely (greyscale print, deuteranopia, a Slack
   screenshot at 40%) and the ladder still reads, because the glyphs are
   shape-ranked: octagon > triangle > diamond > filled dot > hollow ring.
   ========================================================================== */

function Glyph({ severity, size = 12 }: { severity: Severity; size?: number }) {
  const s = size;
  const c = severityVar[severity];
  const common = { width: s, height: s, viewBox: "0 0 12 12", "aria-hidden": true as const };

  switch (severityMeta[severity].icon) {
    case "octagon":
      // Stop sign. The most "interruptive" outline in the set.
      return (
        <svg {...common}>
          <path d="M4.1 0.6h3.8L11.4 4.1v3.8L7.9 11.4H4.1L0.6 7.9V4.1z" fill={c} />
          <path d="M6 3v3.4" stroke="var(--bg-canvas)" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="6" cy="8.6" r="0.85" fill="var(--bg-canvas)" />
        </svg>
      );
    case "triangle":
      return (
        <svg {...common}>
          <path d="M6 0.9 11.5 10.8H0.5z" fill={c} />
          <path d="M6 4.3v2.9" stroke="var(--bg-canvas)" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="6" cy="9.1" r="0.8" fill="var(--bg-canvas)" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...common}>
          <path d="M6 0.7 11.3 6 6 11.3 0.7 6z" fill={c} />
        </svg>
      );
    case "dot":
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="3.6" fill={c} />
        </svg>
      );
    case "info":
    default:
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4.4" fill="none" stroke={c} strokeWidth="1.5" />
          <circle cx="6" cy="3.9" r="0.75" fill={c} />
          <path d="M6 5.9v2.6" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
  }
}

/** Icon + label. The default way severity appears anywhere in the product. */
export function SeverityPill({
  severity,
  className,
  compact,
}: {
  severity: Severity;
  className?: string;
  compact?: boolean;
}) {
  const meta = severityMeta[severity];
  return (
    <span
      className={cn(
        "inline-flex h-[20px] shrink-0 items-center gap-1 rounded-sm border px-1.5",
        "text-2xs font-medium tracking-[0.01em]",
        meta.bg,
        meta.bd,
        meta.fg,
        className
      )}
    >
      <Glyph severity={severity} size={compact ? 10 : 11} />
      {compact ? meta.short : meta.label}
    </span>
  );
}

/** Bare glyph for dense rows (file tree). Carries its label via title + sr-only. */
export function SeverityDot({
  severity,
  count,
  size = 10,
  className,
}: {
  severity: Severity;
  count?: number;
  size?: number;
  className?: string;
}) {
  const meta = severityMeta[severity];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      <Glyph severity={severity} size={size} />
      <span className="sr-only">
        {meta.label}
        {count != null ? `, ${count} findings` : ""}
      </span>
      {count != null ? (
        <span className="tnum text-2xs text-fg-muted" aria-hidden>
          {count}
        </span>
      ) : null}
    </span>
  );
}

/** The 4px vertical bar in the code gutter. Paired with the pill on the row. */
export function SeverityBar({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block w-[3px] shrink-0 rounded-xs", className)}
      style={{ background: severityVar[severity] }}
    />
  );
}

export { Glyph as SeverityGlyph };
