import Link from "next/link";
import { ArrowUpRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { REPO, SCORE, TOP_OFFENDERS } from "@/data/repo";
import { cn, fileName, formatDebt, truncatePath } from "@/lib/utils";
import { Eyebrow } from "@/components/ui/primitives";
import { ScoreGauge } from "@/components/charts/chart-parts";
import {
  DimensionBars,
  GateBadge,
  ScoreTrend,
  SeverityFacets,
  TotalFindingsArea,
} from "@/components/charts/dashboard-charts";

export const metadata = { title: "Insights" };

export default function InsightsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1440px] px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.011em] text-fg">Repository health</h1>
            <p className="mt-0.5 font-mono text-2xs text-fg-muted">
              {REPO.name} · {REPO.branch} · {REPO.commit} · {REPO.lastRun}
            </p>
          </div>
          <GateBadge status={SCORE.gate.status} />
        </div>

        {/* ---- headline row ------------------------------------------------ */}
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex items-center gap-4 rounded-lg border border-subtle bg-surface p-4">
            <ScoreGauge
              score={SCORE.overall}
              label={`rating ${SCORE.rating}`}
              sublabel={`−${Math.abs(SCORE.delta)} vs ${SCORE.baseline}`}
            />
            <div className="min-w-0">
              <Eyebrow>Quality gate</Eyebrow>
              <ul className="mt-1 space-y-1">
                {SCORE.gate.conditions.map((c) => (
                  <li key={c.metric} className="flex items-center gap-2 text-2xs">
                    <span
                      aria-hidden
                      className="w-3 shrink-0 text-center"
                      style={{
                        color: c.status === "passed" ? "var(--sev-success)" : "var(--sev-critical)",
                      }}
                    >
                      {c.status === "passed" ? "✓" : "✕"}
                    </span>
                    <span
                      className={cn(
                        "truncate",
                        c.status === "passed" ? "text-fg-secondary" : "text-fg"
                      )}
                    >
                      {c.metric}
                    </span>
                    <span className="tnum ml-auto shrink-0 font-mono text-fg-muted">
                      {c.actual}
                      {c.unit ?? ""} {c.operator} {c.threshold}
                      {c.unit ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Technical debt"
              value={formatDebt(SCORE.debtMinutes)}
              note={`${SCORE.debtRatio}% debt ratio · ${SCORE.loc.toLocaleString()} lines`}
            />
            <Stat
              label="Coverage on new code"
              value={`${SCORE.coverage}%`}
              note="80% required · 38 of 142 new lines covered"
              bad
            />
            <Stat
              label="Duplication"
              value={`${SCORE.duplication}%`}
              note="3% allowed · templates.js accounts for 4.1pt"
              bad
            />
            <Stat label="Open findings" value="8" note="2 critical · 3 high · 2 medium · 1 low" bad />
          </div>
        </div>

        {/* ---- charts ------------------------------------------------------- */}
        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <ScoreTrend />
          <TotalFindingsArea />
        </div>

        <div className="mt-3">
          <SeverityFacets />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <DimensionBars dimensions={SCORE.dimensions} />
          <TopOffenders />
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  bad,
}: {
  label: string;
  value: string;
  note: string;
  bad?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-subtle bg-surface p-3">
      <Eyebrow>{label}</Eyebrow>
      <span
        className="tnum mt-1 text-lg font-medium leading-none text-fg"
        data-metric
        style={bad ? { color: "var(--sev-critical-fg)" } : undefined}
      >
        {value}
      </span>
      <span className="tnum mt-auto pt-2 text-2xs leading-[1.4] text-fg-muted">{note}</span>
    </div>
  );
}

function TopOffenders() {
  return (
    <section className="rounded-lg border border-subtle bg-surface">
      <div className="flex items-baseline justify-between px-3 pb-2 pt-2.5">
        <span className="text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
          Top offenders
        </span>
        <span className="text-2xs text-fg-faint">by remediation cost</span>
      </div>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {TOP_OFFENDERS.map((f) => {
          const Trend = f.trend === "worse" ? TrendingUp : f.trend === "better" ? TrendingDown : Minus;
          const trendColor =
            f.trend === "worse"
              ? "var(--sev-critical)"
              : f.trend === "better"
                ? "var(--sev-success)"
                : "var(--text-faint)";
          return (
            <li key={f.path}>
              <Link
                href="/reviews"
                className="group flex items-center gap-2 px-3 py-2 hover:bg-hover"
                title={f.path}
              >
                <Trend size={12} style={{ color: trendColor }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-2xs text-fg">{fileName(f.path)}</p>
                  <p className="truncate font-mono text-2xs text-fg-faint">
                    {truncatePath(f.path, 4)}
                  </p>
                </div>
                <span className="tnum shrink-0 text-2xs text-fg-muted">
                  {f.findings} · {formatDebt(f.debt)}
                </span>
                {f.critical > 0 ? (
                  <span
                    className="tnum shrink-0 rounded-sm border border-critical-bd bg-critical-bg px-1 text-2xs font-medium text-critical-fg"
                    aria-label={`${f.critical} critical`}
                  >
                    {f.critical} crit
                  </span>
                ) : (
                  <span className="w-[42px] shrink-0" />
                )}
                <ArrowUpRight
                  size={11}
                  className="shrink-0 text-fg-faint opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-subtle px-3 py-1.5 text-2xs leading-[1.45] text-fg-muted">
        <span className="text-fg-secondary">templates.js</span> improved this run — 2 XSS sinks were
        replaced with an auto-escaping helper — but it still carries the highest debt because 11.4%
        of it is duplicated.
      </p>
    </section>
  );
}
