import Link from "next/link";
import { ArrowUpRight, BarChart3, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { REPO, SCORE, TOP_OFFENDERS } from "@/data/repo";
import { USE_FIXTURES } from "@/lib/api/config";
import { type InsightsOverview, type TopOffender } from "@/lib/api/insights";
import { insightsOverviewServer } from "@/lib/api/server-fetchers";
import { repositoryServer } from "@/lib/api/server-fetchers";
import type { Dimension, QualityGate } from "@/lib/types";
import { cn, fileName, formatDebt, pluralize, ratingFromScore, truncatePath } from "@/lib/utils";
import { Button, Eyebrow } from "@/components/ui/primitives";
import { ScoreGauge } from "@/components/charts/chart-parts";
import {
  DimensionBars,
  GateBadge,
  ScoreTrend,
  SeverityFacets,
  TotalFindingsArea,
} from "@/components/charts/dashboard-charts";
import { ResolveActiveProject } from "@/components/shell/resolve-active-project";

export const metadata = { title: "Insights" };

/**
 * Repository health.
 *
 * Server component, `?repo=<id>` — same contract as `reviews/page.tsx`. The
 * whole dashboard comes from one endpoint (`GET /insights?repoId=`), because
 * score, gate, trend and offenders are one reading of one run and five
 * requests would give them five loading states.
 *
 * ── EVERY NUMBER ON THIS PAGE IS FROM A REAL RUN ──
 *
 * Except two, which are not measured at all, and say so rather than
 * substituting a plausible-looking figure: see `coverageStat` and
 * `duplicationStat`. That distinction is the point of the screen — a dashboard
 * that mixes measurements with decoration cannot be used to make a decision,
 * because the reader has no way to tell which is which.
 */
export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  const { repo } = await searchParams;

  // Design mode — the sample repository, unchanged.
  if (USE_FIXTURES) return <FixtureInsights />;

  // No repo in the URL: bounce through the client to pick up the active
  // project. The server cannot read localStorage.
  if (!repo) return <ResolveActiveProject path="/insights" />;

  const [overview, repository] = await Promise.all([
    insightsOverviewServer(repo),
    repositoryServer(repo),
  ]);

  if (!overview) return <Unavailable />;
  if (!overview.latestRunId) return <NotAnalysedYet repoId={repo} name={repository?.name} />;

  return (
    <RealInsights
      overview={overview}
      // Null when the folder was disconnected but its runs are still on record.
      // Naming it "this project" would hide that; the header says so instead.
      name={repository?.name ?? null}
      branch={repository?.branch ?? null}
      repoId={repo}
    />
  );
}

/* -- the real dashboard ------------------------------------------------------ */

function RealInsights({
  overview,
  name,
  branch,
  repoId,
}: {
  overview: InsightsOverview;
  name: string | null;
  branch: string | null;
  repoId: string;
}) {
  const {
    score,
    rating,
    delta,
    gate,
    dimensions,
    debtMinutes,
    debtRatio,
    loc,
    findingCounts,
    trend,
    severityTrend,
    topOffenders,
  } = overview;

  const latest = trend[trend.length - 1];
  const runs = trend.length;
  const totalFindings = Object.values(findingCounts).reduce((a, b) => a + b, 0);

  const scorePoints = trend.map((t) => ({ commit: t.commit, score: t.score }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1440px] px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.011em] text-fg">Repository health</h1>
            <p className="mt-0.5 font-mono text-2xs text-fg-muted">
              {name ?? "disconnected project"}
              {branch ? ` · ${branch}` : ""} · {latest ? timeAgo(latest.createdAt) : "never analysed"}
            </p>
            {name === null ? (
              <p className="mt-0.5 text-2xs text-fg-faint">
                This folder is no longer connected. The numbers below are its last recorded runs.
              </p>
            ) : null}
          </div>
          {gate ? <GateBadge status={gate.status} /> : null}
        </div>

        {/* ---- headline row ------------------------------------------------ */}
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex items-center gap-4 rounded-lg border border-subtle bg-surface p-4">
            <ScoreGauge
              score={score ?? 0}
              label={`rating ${rating ?? ratingFromScore(score ?? 0)}`}
              // The backend's delta is against the PREVIOUS RUN — there is no
              // `main` to compare a local folder to. The sign comes from the
              // value; the fixture hardcoded a minus, which would render a
              // gain as a loss.
              sublabel={
                runs < 2
                  ? "first analysis"
                  : `${delta >= 0 ? "+" : "−"}${Math.abs(delta)} vs previous run`
              }
            />
            <div className="min-w-0">
              <Eyebrow>Quality gate</Eyebrow>
              {gate && gate.conditions.length > 0 ? (
                <GateConditions gate={gate} />
              ) : (
                <p className="mt-1 text-2xs text-fg-muted">No gate conditions were evaluated.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Technical debt"
              value={debtMinutes != null ? formatDebt(debtMinutes) : "—"}
              note={
                debtRatio != null && loc != null
                  ? `${debtRatio}% debt ratio · ${loc.toLocaleString()} lines`
                  : "Not enough data"
              }
            />
            {coverageStat()}
            {duplicationStat(gate)}
            <Stat
              label="Open findings"
              value={String(totalFindings)}
              note={severityBreakdown(findingCounts)}
              bad={totalFindings > 0}
            />
          </div>
        </div>

        {/* ---- charts ------------------------------------------------------- */}
        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <ScoreTrend
            points={scorePoints}
            title={`Quality score · last ${pluralize(runs, "run")}`}
            why={describeScore(scorePoints)}
            // No `main` baseline exists for a local folder, so no reference line.
            baseline={null}
          />
          <TotalFindingsArea points={severityTrend} why={describeTotal(severityTrend)} />
        </div>

        <div className="mt-3">
          <SeverityFacets points={severityTrend} notes={describeSeverities(severityTrend)} />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <DimensionBars dimensions={dimensions as Dimension[]} />
          <TopOffenders offenders={topOffenders} repoId={repoId} />
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}

function GateConditions({ gate }: { gate: QualityGate }) {
  return (
    <ul className="mt-1 space-y-1">
      {gate.conditions.map((c) => (
        <li key={c.metric} className="flex items-center gap-2 text-2xs">
          <span
            aria-hidden
            className="w-3 shrink-0 text-center"
            style={{ color: c.status === "passed" ? "var(--sev-success)" : "var(--sev-critical)" }}
          >
            {c.status === "passed" ? "✓" : "✕"}
          </span>
          <span className={cn("truncate", c.status === "passed" ? "text-fg-secondary" : "text-fg")}>
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
  );
}

/* -- the two tiles that are honest about not knowing -------------------------- */

/**
 * Coverage is not measured. Nothing reads a coverage report, which is why the
 * gate has no coverage condition at all (`gate.ts` omits it when the value is
 * null rather than scoring it as 0 and failing every project).
 *
 * Rendering "—" costs a tile that used to show a confident 26.8%. That number
 * was fixture text, and a reader who trusted it would have been told their
 * untested code was two-thirds covered.
 */
function coverageStat() {
  return (
    <Stat
      label="Coverage on new code"
      value="—"
      note="Not measured — no coverage report is read yet"
      muted
    />
  );
}

/**
 * Duplication is not measured either, and the gate now says so by omission
 * rather than by scoring it.
 *
 * It used to be reported as a flat 0% — the orchestrator passed a literal zero
 * — which put a row in every gate that read like a measurement and could never
 * fail. Both are `null` at the source now, so the condition simply is not
 * there, exactly as with coverage. If jscpd ever does run, the row reappears
 * with a real number and this tile renders it instead of the dash.
 */
function duplicationStat(gate: QualityGate | null) {
  const condition = gate?.conditions.find((c) => c.metric.toLowerCase().includes("duplicat"));
  if (condition) {
    return <Stat label="Duplication" value={`${condition.actual}%`} note="Measured on this run" />;
  }
  return (
    <Stat
      label="Duplication"
      value="—"
      note="Not measured — no duplication engine runs yet"
      muted
    />
  );
}

/* -- derived prose ----------------------------------------------------------- */

/**
 * The product's rule is that no number appears without saying why it moved.
 * These are derived from the series rather than written, because a hand-written
 * sentence about a specific commit ("−21 across the last four") is a lie the
 * moment it is rendered over a different repository.
 */
function describeScore(points: { commit: string; score: number }[]): string {
  if (points.length < 2) {
    return "First analysis — the trend line fills in from the second run onward.";
  }
  const first = points[0].score;
  const last = points[points.length - 1].score;
  const n = points.length;
  if (first === last) {
    return `Flat at ${last} across ${n} runs — no finding was added or resolved that changed the weighting.`;
  }
  const dir = last > first ? "up" : "down";
  return `${dir === "up" ? "Up" : "Down"} ${Math.abs(last - first)} across ${n} runs, ${first} → ${last}.`;
}

function describeTotal(
  points: { critical: number; high: number; medium: number; low: number; info?: number }[]
): string {
  const total = (p: (typeof points)[number]) =>
    p.critical + p.high + p.medium + p.low + (p.info ?? 0);
  if (points.length < 2) {
    return `${pluralize(total(points[0]), "finding")} open in the first analysis of this project.`;
  }
  const net = total(points[points.length - 1]) - total(points[0]);
  if (net === 0) return `Unchanged across ${points.length} runs.`;
  return `Net ${net > 0 ? "+" : "−"}${Math.abs(net)} over ${points.length} runs.`;
}

function describeSeverities(
  points: { critical: number; high: number; medium: number; low: number }[]
): Record<"critical" | "high" | "medium" | "low", string> {
  const keys = ["critical", "high", "medium", "low"] as const;
  const out = {} as Record<(typeof keys)[number], string>;
  for (const key of keys) {
    const first = points[0][key];
    const last = points[points.length - 1][key];
    if (points.length < 2) {
      out[key] = last === 0 ? "None in this run." : `${last} in the first run.`;
    } else if (first === last) {
      out[key] = last === 0 ? "None, throughout." : `Flat at ${last}.`;
    } else {
      out[key] = `${last > first ? "+" : "−"}${Math.abs(last - first)} over ${points.length} runs.`;
    }
  }
  return out;
}

function severityBreakdown(counts: Record<string, number>): string {
  const order = ["critical", "high", "medium", "low", "info"];
  const parts = order.filter((k) => counts[k] > 0).map((k) => `${counts[k]} ${k}`);
  return parts.length > 0 ? parts.join(" · ") : "Nothing open";
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${pluralize(minutes, "minute")} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${pluralize(hours, "hour")} ago`;
  return `${pluralize(Math.round(hours / 24), "day")} ago`;
}

/* -- pieces ------------------------------------------------------------------ */

function Stat({
  label,
  value,
  note,
  bad,
  muted,
}: {
  label: string;
  value: string;
  note: string;
  bad?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-subtle bg-surface p-3">
      <Eyebrow>{label}</Eyebrow>
      <span
        className="tnum mt-1 text-lg font-medium leading-none text-fg"
        data-metric
        style={
          bad
            ? { color: "var(--sev-critical-fg)" }
            : muted
              ? { color: "var(--text-faint)" }
              : undefined
        }
      >
        {value}
      </span>
      <span className="tnum mt-auto pt-2 text-2xs leading-[1.4] text-fg-muted">{note}</span>
    </div>
  );
}

function TopOffenders({ offenders, repoId }: { offenders: TopOffender[]; repoId: string }) {
  return (
    <section className="rounded-lg border border-subtle bg-surface">
      <div className="flex items-baseline justify-between px-3 pb-2 pt-2.5">
        <span className="text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
          Top offenders
        </span>
        <span className="text-2xs text-fg-faint">by remediation cost</span>
      </div>

      {offenders.length === 0 ? (
        <p className="px-3 pb-3 text-2xs text-fg-muted">
          No file carries a finding in this run.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {offenders.map((f) => {
            const Trend =
              f.trend === "worse" ? TrendingUp : f.trend === "better" ? TrendingDown : Minus;
            const trendColor =
              f.trend === "worse"
                ? "var(--sev-critical)"
                : f.trend === "better"
                  ? "var(--sev-success)"
                  : "var(--text-faint)";
            return (
              <li key={f.path}>
                <Link
                  // Deep-links to this file's findings rather than to whatever
                  // the review screen opens by default.
                  href={`/reviews?repo=${encodeURIComponent(repoId)}&file=${encodeURIComponent(f.path)}`}
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
      )}
    </section>
  );
}

/* -- states ------------------------------------------------------------------ */

function NotAnalysedYet({ repoId, name }: { repoId: string; name?: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-[420px] text-center">
        <BarChart3 size={22} className="mx-auto text-fg-faint" aria-hidden />
        <h1 className="mt-3 text-sm font-medium text-fg">Nothing to chart yet</h1>
        <p className="mt-1 text-2xs text-fg-muted">
          {name ? `${name} has` : "This project has"} not been analysed. Run the analysis and
          every number on this page comes from it.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button size="sm" variant="primary" asChild>
            <Link href={`/runs?repo=${encodeURIComponent(repoId)}`}>Analyse now</Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/repositories">Back to repositories</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The API did not answer. Deliberately NOT a fixture fallback: this screen's
 * whole claim is that its numbers are measurements, and quietly swapping in
 * sample data when the backend is down would break that claim exactly when the
 * reader has no way to notice.
 */
function Unavailable() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-[420px] text-center">
        <BarChart3 size={22} className="mx-auto text-fg-faint" aria-hidden />
        <h1 className="mt-3 text-sm font-medium text-fg">Dashboard unavailable</h1>
        <p className="mt-1 text-2xs text-fg-muted">
          The API did not respond. Nothing is shown rather than sample data, so this page never
          reports a number that was not measured.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button size="sm" variant="ghost" asChild>
            <Link href="/repositories">Back to repositories</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -- design mode ------------------------------------------------------------- */

/** The sample repository, for NEXT_PUBLIC_USE_FIXTURES=true. Unchanged. */
function FixtureInsights() {
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

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex items-center gap-4 rounded-lg border border-subtle bg-surface p-4">
            <ScoreGauge
              score={SCORE.overall}
              label={`rating ${SCORE.rating}`}
              sublabel={`−${Math.abs(SCORE.delta)} vs ${SCORE.baseline}`}
            />
            <div className="min-w-0">
              <Eyebrow>Quality gate</Eyebrow>
              <GateConditions gate={SCORE.gate} />
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

        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <ScoreTrend title="Quality score · last 30 commits" />
          <TotalFindingsArea />
        </div>

        <div className="mt-3">
          <SeverityFacets />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <DimensionBars dimensions={SCORE.dimensions} />
          <TopOffenders offenders={TOP_OFFENDERS as TopOffender[]} repoId="" />
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
