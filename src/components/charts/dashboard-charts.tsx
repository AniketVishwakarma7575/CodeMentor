"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Dimension, Severity } from "@/lib/types";
import { SEVERITY_TREND, TREND } from "@/data/repo";
import { cn, ratingColorVar, scoreColorVar, severityMeta, severityVar } from "@/lib/utils";
import { AXIS, ChartFrame, ChartTooltip, Delta } from "./chart-parts";
import { SeverityGlyph } from "@/components/severity";

/* ============================================================================
   Score trend — 30 commits, one series.

   One series, so no legend: the frame title names it. Direct-labelled at the
   endpoint only, with a reference line at the main baseline so the drop has
   something to be a drop *from*.
   ========================================================================== */

export interface ScorePoint {
  commit: string;
  score: number;
}

/**
 * `points` defaults to the fixture series so the design mode still renders the
 * full 30-commit story. Real data arrives as a prop — usually far fewer points,
 * which is why the title carries the count and the tick interval is derived
 * rather than pinned at 6.
 *
 * `baseline` is optional because a local folder has no `main` to be measured
 * against. Drawing the fixture's "main 52" line over three real runs would
 * assert a comparison that was never made.
 */
export function ScoreTrend({
  points = TREND,
  title,
  why = "Flat through c01–c26, then −21 across the last four commits — all of it on feat/order-search, where the order-search handlers were added without parameter binding.",
  baseline = { value: 52, label: "main 52" },
}: {
  points?: ScorePoint[];
  title?: string;
  why?: string;
  baseline?: { value: number; label: string } | null;
} = {}) {
  if (points.length === 0) return null;
  const last = points[points.length - 1].score;
  const first = points[0].score;

  return (
    <ChartFrame
      title={title ?? `Quality score · last ${points.length} runs`}
      value={last}
      delta={<Delta value={last - first} />}
      why={why}
      className="min-h-[196px]"
    >
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={points} margin={{ top: 8, right: 34, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={AXIS.stroke} vertical={false} />
          <XAxis
            dataKey="commit"
            tickLine={false}
            axisLine={false}
            tick={AXIS.tick}
            interval={tickInterval(points.length)}
            minTickGap={12}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tickLine={false}
            axisLine={false}
            tick={AXIS.tick}
            width={22}
          />
          {baseline ? (
            <ReferenceLine
              y={baseline.value}
              stroke="var(--border-strong)"
              strokeWidth={1}
              label={{
                value: baseline.label,
                position: "insideTopRight",
                fill: "var(--text-faint)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
            />
          ) : null}
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={<ChartTooltip labelPrefix="commit " />}
          />
          <Line
            type="monotone"
            dataKey="score"
            name="Score"
            stroke="var(--text-secondary)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 3.5, fill: "var(--text-primary)", stroke: "var(--bg-surface)", strokeWidth: 2 }}
          />
          {/* The endpoint is the only labelled point — it is the one that matters. */}
          <Line
            dataKey="score"
            legendType="none"
            stroke="none"
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; index?: number }) =>
              props.index === points.length - 1 ? (
                <g key="end">
                  <circle cx={props.cx} cy={props.cy} r={3.5} fill={scoreColorVar(last)} />
                  <text
                    x={(props.cx ?? 0) + 7}
                    y={(props.cy ?? 0) + 4}
                    fill={scoreColorVar(last)}
                    fontSize={11}
                    fontFamily="var(--font-mono)"
                  >
                    {last}
                  </text>
                </g>
              ) : (
                <g key={`e${props.index}`} />
              )
            }
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ============================================================================
   Findings by severity over time.

   Deliberately NOT a four-band stacked area.

   Severity red / orange / amber sit ~22° apart in hue. As adjacent fills in one
   stack they fail an adjacent-pair separation check even for full-colour
   readers (ΔE 9.8 against a floor of 15), and collapse entirely under
   deuteranopia. Secondary encoding does not rescue that.

   Faceting into one chart per severity makes every chart single-series, which
   removes the adjacency problem completely — and it answers the question the
   reader actually has ("did critical move?") without them having to
   mentally un-stack four bands.
   ========================================================================== */

type FacetKey = Extract<Severity, "critical" | "high" | "medium" | "low">;

const FACETS: { key: FacetKey; why: string }[] = [
  { key: "critical", why: "+2 at c28 — both SQL injections landed in one commit." },
  { key: "high", why: "+3 since c26; the XSS is new, the MD5 and the JWT key are pre-existing." },
  { key: "medium", why: "Flat. The complexity finding replaced one that was fixed." },
  { key: "low", why: "−4 over the window — mostly max-len cleared by the formatter." },
];

export interface SeverityPoint {
  idx: number;
  commit: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  /** Not faceted — see the note on the facet header — but counted in totals. */
  info?: number;
}

/**
 * `notes` replaces the per-facet narrative when real data is supplied. The
 * fixture strings name specific commits ("+2 at c28 — both SQL injections
 * landed in one commit") and are false about any other repository, so a caller
 * passing real points must pass its own notes with them.
 */
export function SeverityFacets({
  points = SEVERITY_TREND,
  notes,
}: {
  points?: SeverityPoint[];
  notes?: Partial<Record<FacetKey, string>>;
} = {}) {
  if (points.length === 0) return null;

  // ⚠️ ONE domain for all four facets. Per-facet auto-scaling is what makes
  //    "low: 11" and "critical: 3" draw the same height, which is the exact
  //    misreading this layout exists to prevent. Derived from the data rather
  //    than pinned, with a floor so a flat all-zero window is not a full-height
  //    band of nothing.
  const peak = Math.max(1, ...points.flatMap((d) => [d.critical, d.high, d.medium, d.low]));
  const domain: [number, number] = [0, Math.ceil(peak * 1.15)];
  const infoTotal = points[points.length - 1].info ?? 0;

  return (
    <div className="rounded-lg border border-subtle bg-surface">
      <div className="flex items-baseline justify-between px-3 pb-1 pt-2.5">
        <span className="text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
          Findings by severity · last {points.length === 1 ? "run" : `${points.length} runs`}
        </span>
        {/* Says so explicitly: four facets over five severities means these
            columns do not add up to the headline count, and a reader who tries
            to reconcile them deserves to know why rather than to conclude one
            of the two numbers is wrong. */}
        <span className="text-2xs text-fg-faint">
          shared y-scale{infoTotal > 0 ? ` · ${infoTotal} info not shown` : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)] xl:grid-cols-4">
        {FACETS.map(({ key, why: fixtureWhy }) => {
          const why = notes ? notes[key] : fixtureWhy;
          const series = points.map((d) => ({ idx: d.idx, commit: d.commit, v: d[key] }));
          const now = series[series.length - 1].v;
          const then = series[0].v;
          return (
            <div key={key} className="bg-surface px-2 pb-1.5 pt-2">
              <div className="flex items-center gap-1.5 px-1">
                <SeverityGlyph severity={key} size={10} />
                <span className="text-2xs text-fg-secondary">{severityMeta[key].label}</span>
                <span className="tnum ml-auto text-sm font-medium text-fg" data-metric>
                  {now}
                </span>
                <Delta value={now - then} invert />
              </div>

              <ResponsiveContainer width="100%" height={56}>
                <AreaChart data={series} margin={{ top: 6, right: 2, bottom: 0, left: 2 }}>
                  <defs>
                    <linearGradient id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={severityVar[key]} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={severityVar[key]} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  {/* Shared domain across all four facets — otherwise each chart
                      silently rescales and "low: 11" looks like "critical: 3". */}
                  <YAxis domain={domain} hide />
                  <XAxis dataKey="commit" hide />
                  <Tooltip
                    cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                    content={<ChartTooltip labelPrefix="commit " />}
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    name={severityMeta[key].label}
                    stroke={severityVar[key]}
                    strokeWidth={1.5}
                    fill={`url(#fill-${key})`}
                    isAnimationActive={false}
                    dot={false}
                    activeDot={{ r: 3, fill: severityVar[key], stroke: "var(--bg-surface)", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>

              {why ? <p className="px-1 text-2xs leading-[1.4] text-fg-muted">{why}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
   The seven dimensions, as small multiples.

   Bars rather than a radar: a radar makes seven values into a shape, and a
   shape is exactly the wrong affordance when six of the seven are failing and
   the reader needs to rank them. Bars sort; radars do not.
   ========================================================================== */

export function DimensionBars({ dimensions }: { dimensions: Dimension[] }) {
  const sorted = [...dimensions].sort((a, b) => a.score - b.score);

  return (
    <div className="rounded-lg border border-subtle bg-surface">
      <div className="flex items-baseline justify-between px-3 pb-2 pt-2.5">
        <span className="text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
          Sub-dimensions
        </span>
        <span className="text-2xs text-fg-faint">worst first · weighted</span>
      </div>

      <ul className="divide-y divide-[var(--border-subtle)]">
        {sorted.map((d) => (
          <li key={d.key} className="px-3 py-2">
            <div className="flex items-center gap-2">
              <span
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border text-2xs font-medium"
                style={{ color: ratingColorVar(d.rating), borderColor: "var(--border-subtle)" }}
                aria-label={`Rating ${d.rating}`}
              >
                {d.rating}
              </span>
              <span className="truncate text-sm text-fg">{d.label}</span>
              <span className="tnum ml-auto shrink-0 text-2xs text-fg-faint">{d.weight}% weight</span>
              <span className="tnum w-7 shrink-0 text-right text-sm font-medium text-fg" data-metric>
                {d.score}
              </span>
              <span className="w-9 shrink-0 text-right">
                <Delta value={d.delta} />
              </span>
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              {/* Thin mark, rounded data-end anchored to the baseline. */}
              <div className="relative h-1 flex-1 overflow-hidden rounded-xs bg-active">
                <div
                  className="absolute inset-y-0 left-0 rounded-xs"
                  style={{ width: `${d.score}%`, background: scoreColorVar(d.score) }}
                />
              </div>
            </div>

            <p className="mt-1 text-2xs leading-[1.45] text-fg-muted">{d.reason}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================================
   Total findings — one series, so the stacked-area question still gets an
   answer, just without four near-adjacent hues fighting each other.
   ========================================================================== */

export function TotalFindingsArea({
  points = SEVERITY_TREND,
  why,
}: {
  points?: SeverityPoint[];
  why?: string;
} = {}) {
  if (points.length === 0) return null;
  // `info` included. This chart is titled "total", and the headline stat counts
  // every severity — a chart that quietly dropped one would put 30 next to 35
  // on the same screen with nothing to explain the gap.
  const data = points.map((d) => ({
    commit: d.commit,
    total: d.critical + d.high + d.medium + d.low + (d.info ?? 0),
  }));
  const now = data[data.length - 1].total;
  const then = data[0].total;

  return (
    <ChartFrame
      title="Total open findings"
      value={now}
      delta={<Delta value={now - then} invert />}
      why={
        why ??
        `Net ${now - then > 0 ? "+" : "−"}${Math.abs(now - then)} over ${points.length} runs. The rise is concentrated in the last four; low-severity noise fell as the formatter landed at c19.`
      }
      className="min-h-[196px]"
    >
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="fill-total" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--text-secondary)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--text-secondary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={AXIS.stroke} vertical={false} />
          <XAxis
            dataKey="commit"
            tickLine={false}
            axisLine={false}
            tick={AXIS.tick}
            interval={tickInterval(data.length)}
          />
          <YAxis tickLine={false} axisLine={false} tick={AXIS.tick} width={22} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={<ChartTooltip labelPrefix="commit " />}
          />
          <Area
            type="monotone"
            dataKey="total"
            name="Findings"
            stroke="var(--text-secondary)"
            strokeWidth={2}
            fill="url(#fill-total)"
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 3.5, fill: "var(--text-primary)", stroke: "var(--bg-surface)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/**
 * Roughly five x-axis labels, whatever the series length.
 *
 * Recharts' `interval` is "skip N between ticks", so it has to be derived: the
 * fixture's hardcoded 6 is right for 30 points and renders a single lonely tick
 * for a repo with three runs.
 */
function tickInterval(count: number): number {
  return Math.max(0, Math.ceil(count / 5) - 1);
}

/* -- quality gate ----------------------------------------------------------- */

export function GateBadge({ status, className }: { status: "passed" | "failed"; className?: string }) {
  const passed = status === "passed";
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-sm border px-2 text-2xs font-medium",
        passed
          ? "border-success-bd bg-success-bg text-success-fg"
          : "border-critical-bd bg-critical-bg text-critical-fg",
        className
      )}
    >
      <span aria-hidden className="text-[13px] leading-none">
        {passed ? "✓" : "✕"}
      </span>
      Quality gate {passed ? "passed" : "failed"}
    </span>
  );
}
