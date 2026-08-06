"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { cn, scoreColorVar } from "@/lib/utils";
import { countUp } from "@/lib/motion";
import { Eyebrow } from "@/components/ui/primitives";

/* ============================================================================
   Chart chrome.

   Two rules do most of the work in making Recharts stop looking like Recharts:
     • grid and axes are hairline solids one shade off the surface, never dashed
     • no value is printed on every point — the axis and the tooltip carry it,
       and exactly one endpoint gets a direct label

   And one rule that is this product's own: a chart never states a number
   without stating why it moved. The `why` prop is required, not optional.
   ========================================================================== */

export const AXIS = {
  stroke: "var(--border-subtle)",
  tick: { fill: "var(--text-faint)", fontSize: 10, fontFamily: "var(--font-mono)" },
} as const;

export function ChartFrame({
  title,
  value,
  delta,
  why,
  children,
  className,
  action,
}: {
  title: string;
  value?: React.ReactNode;
  delta?: React.ReactNode;
  /** Why the number moved. The chart is not allowed to ship without it. */
  why: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col rounded-lg border border-subtle bg-surface", className)}>
      <header className="flex items-start justify-between gap-3 px-3 pb-1.5 pt-2.5">
        <div className="min-w-0">
          <Eyebrow>{title}</Eyebrow>
          {value != null ? (
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="tnum text-lg font-medium leading-none text-fg" data-metric>
                {value}
              </span>
              {delta}
            </div>
          ) : null}
        </div>
        {action}
      </header>
      <div className="min-h-0 flex-1 px-1">{children}</div>
      <p className="border-t border-subtle px-3 py-1.5 text-2xs leading-[1.45] text-fg-muted">{why}</p>
    </section>
  );
}

export function Delta({ value, unit = "", invert }: { value: number; unit?: string; invert?: boolean }) {
  if (value === 0) {
    return <span className="tnum text-2xs text-fg-faint">no change</span>;
  }
  // "Good" is direction-dependent: a rising score is good, rising findings are not.
  const good = invert ? value < 0 : value > 0;
  return (
    <span
      className="tnum text-2xs font-medium"
      style={{ color: good ? "var(--sev-success)" : "var(--sev-critical)" }}
    >
      {value > 0 ? "+" : "−"}
      {Math.abs(value)}
      {unit}
    </span>
  );
}

/* -- tooltip ---------------------------------------------------------------- */

export function ChartTooltip({
  active,
  payload,
  label,
  labelPrefix = "",
  unit = "",
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: string | number;
  labelPrefix?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-strong bg-elevated px-2 py-1.5 shadow-[var(--shadow-popover)]">
      <p className="tnum font-mono text-2xs text-fg-faint">
        {labelPrefix}
        {label}
      </p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-2xs text-fg">
          {p.color ? (
            <span aria-hidden className="h-1.5 w-1.5 rounded-xs" style={{ background: p.color }} />
          ) : null}
          {p.name ? <span className="text-fg-secondary">{p.name}</span> : null}
          <span className="tnum font-medium">
            {p.value}
            {unit}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ============================================================================
   Score gauge.

   Hand-rolled SVG rather than Recharts' RadialBarChart: one value, one arc, and
   full control over the sweep, the cap and the counting numeral. Pulling in a
   chart library to draw a single arc is how dashboards get slow.

   Lighthouse-style banding, but the band is also named in text under the
   numeral — the colour is a reinforcement, never the message.
   ========================================================================== */

export function ScoreGauge({
  score,
  size = 148,
  label,
  sublabel,
}: {
  score: number;
  size?: number;
  label?: string;
  sublabel?: string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = React.useState(reduce ? score : 0);

  React.useEffect(() => countUp(0, score, setShown, { duration: 0.4, reduced: !!reduce }), [score, reduce]);

  const stroke = 9;
  const r = (size - stroke) / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  // 270° arc, opening at the bottom.
  const START = 135;
  const SWEEP = 270;
  const circumference = 2 * Math.PI * r;
  const arcLen = (SWEEP / 360) * circumference;
  const filled = (shown / 100) * arcLen;
  const color = scoreColorVar(score);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`Quality score ${Math.round(score)} out of 100`}>
        <g transform={`rotate(${START} ${cx} ${cy})`}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--bg-active)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${circumference}`}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-2xl font-semibold leading-none tracking-[-0.02em] text-fg" data-metric>
          {Math.round(shown)}
        </span>
        {label ? <span className="mt-1 text-2xs text-fg-muted">{label}</span> : null}
        {sublabel ? <span className="tnum text-2xs text-fg-faint">{sublabel}</span> : null}
      </div>
    </div>
  );
}
