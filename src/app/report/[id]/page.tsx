import Link from "next/link";
import type { Metadata } from "next";
import { REPO, SCORE, TOP_OFFENDERS } from "@/data/repo";
import { FINDINGS } from "@/data/findings";
import {
  labelForEngine,
  fileName,
  formatDebt,
  ratingColorVar,
  scoreColorVar,
  severityMeta,
  truncatePath,
} from "@/lib/utils";
import type { Severity } from "@/lib/types";
import { SeverityGlyph } from "@/components/severity";
import { PrintButton } from "@/components/report/print-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const title = `${REPO.name} · quality ${SCORE.overall}/100`;
  const description = `Quality gate failed. 8 findings — 2 critical, 3 high, 2 medium, 1 low. ${formatDebt(SCORE.debtMinutes)} of remediation on ${REPO.branch}.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      // Rendered by /report/[id]/opengraph-image.tsx
      url: `/report/${id}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

const ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

/**
 * Public report.
 *
 * Server component, no shell, no client JS beyond a print button. It has three
 * jobs, in this order: read well as a link in Slack (hence the OG card), read
 * well as a PDF (hence the print stylesheet and the avoid-break rules), and
 * still be scannable in ten seconds by someone who has never used the product.
 */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const counts = ORDER.map((s) => ({ s, n: FINDINGS.filter((f) => f.severity === s).length })).filter(
    (c) => c.n > 0
  );

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-[820px] px-6 py-8 print:max-w-none print:px-0 print:py-0">
        {/* ---- masthead ---------------------------------------------------- */}
        <header className="flex items-start justify-between gap-4 border-b border-subtle pb-4">
          <div className="min-w-0">
            <p className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-faint">
              CodeMentor AI · analysis report
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-[-0.014em] text-fg">
              {REPO.name}
            </h1>
            <p className="tnum mt-0.5 font-mono text-2xs text-fg-muted">
              {REPO.branch} · {REPO.commit} · PR #{REPO.pr} · run {id}
            </p>
          </div>
          <PrintButton />
        </header>

        {/* ---- verdict ------------------------------------------------------
            The first thing on the page is the decision, not the data. */}
        <section className="print-break mt-5 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-lg border border-subtle bg-surface p-5">
          <div className="flex items-baseline gap-2">
            <span
              className="tnum text-3xl font-semibold leading-none tracking-[-0.026em]"
              data-metric
              style={{ color: scoreColorVar(SCORE.overall) }}
            >
              {SCORE.overall}
            </span>
            <span className="text-md text-fg-faint">/100</span>
            <span
              className="ml-1 flex h-6 w-6 items-center justify-center rounded-sm border text-sm font-medium"
              style={{ color: ratingColorVar(SCORE.rating), borderColor: "var(--border-strong)" }}
              aria-label={`Rating ${SCORE.rating}`}
            >
              {SCORE.rating}
            </span>
          </div>

          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-critical-fg">
              <span aria-hidden>✕</span> Quality gate failed
            </p>
            <p className="tnum mt-0.5 text-2xs text-fg-muted">
              4 of 5 conditions not met · {Math.abs(SCORE.delta)} points below {SCORE.baseline}
            </p>
          </div>

          <dl className="ml-auto flex gap-6">
            {[
              ["Findings", String(FINDINGS.length)],
              ["Debt", formatDebt(SCORE.debtMinutes)],
              ["New-code coverage", `${SCORE.coverage}%`],
              ["Duplication", `${SCORE.duplication}%`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-2xs text-fg-faint">{k}</dt>
                <dd className="tnum text-md font-medium text-fg" data-metric>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---- severity summary --------------------------------------------- */}
        <section className="print-break mt-4">
          <h2 className="text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
            Findings by severity
          </h2>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {counts.map(({ s, n }) => (
              <div
                key={s}
                className="flex items-center gap-2 rounded-md border border-subtle bg-surface px-2.5 py-1.5"
              >
                <SeverityGlyph severity={s} size={11} />
                <span className="text-sm text-fg-secondary">{severityMeta[s].label}</span>
                <span className="tnum text-sm font-medium text-fg" data-metric>
                  {n}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ---- dimensions ---------------------------------------------------- */}
        <section className="print-break mt-5">
          <h2 className="text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
            Sub-dimensions
          </h2>
          <table className="mt-1.5 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-subtle text-left">
                <th className="py-1.5 font-medium text-fg-muted">Dimension</th>
                <th className="w-12 py-1.5 text-right font-medium text-fg-muted">Rating</th>
                <th className="w-14 py-1.5 text-right font-medium text-fg-muted">Score</th>
                <th className="w-14 py-1.5 text-right font-medium text-fg-muted">Δ</th>
              </tr>
            </thead>
            <tbody>
              {SCORE.dimensions.map((d) => (
                <tr key={d.key} className="border-b border-subtle align-top">
                  <td className="py-2 pr-3">
                    <div className="text-fg">{d.label}</div>
                    <div className="mt-0.5 text-2xs leading-[1.45] text-fg-muted">{d.reason}</div>
                  </td>
                  <td className="py-2 text-right">
                    <span className="font-medium" style={{ color: ratingColorVar(d.rating) }}>
                      {d.rating}
                    </span>
                  </td>
                  <td className="tnum py-2 text-right text-fg">{d.score}</td>
                  <td
                    className="tnum py-2 text-right"
                    style={{
                      color: d.delta >= 0 ? "var(--sev-success)" : "var(--sev-critical)",
                    }}
                  >
                    {d.delta === 0 ? "±0" : `${d.delta > 0 ? "+" : "−"}${Math.abs(d.delta)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ---- findings ------------------------------------------------------ */}
        <section className="mt-5">
          <h2 className="text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
            All findings
          </h2>
          <ol className="mt-1.5 divide-y divide-[var(--border-subtle)] rounded-lg border border-subtle bg-surface">
            {[...FINDINGS]
              .sort((a, b) => severityMeta[a.severity].rank - severityMeta[b.severity].rank)
              .map((f) => (
                <li key={f.id} className="print-break px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-[3px]">
                      <SeverityGlyph severity={f.severity} size={11} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-[1.45] text-fg">{f.title}</p>
                      <p className="tnum mt-0.5 font-mono text-2xs text-fg-muted">
                        {severityMeta[f.severity].label} · {f.file}:{f.line} · {f.ruleKey}
                        {f.cwe ? ` · ${f.cwe.id}` : ""} · {labelForEngine(f.engine)} · {f.confidence}%
                      </p>
                      <p className="mt-1 text-2xs leading-[1.5] text-fg-secondary">{f.whatsWrong}</p>
                    </div>
                    <span className="tnum shrink-0 text-2xs text-fg-faint">
                      {formatDebt(f.effortMinutes)}
                    </span>
                  </div>
                </li>
              ))}
          </ol>
        </section>

        {/* ---- offenders ------------------------------------------------------ */}
        <section className="print-break mt-5">
          <h2 className="text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
            Highest remediation cost
          </h2>
          <ul className="mt-1.5 divide-y divide-[var(--border-subtle)] rounded-lg border border-subtle bg-surface">
            {TOP_OFFENDERS.slice(0, 5).map((f) => (
              <li key={f.path} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-2xs text-fg">{fileName(f.path)}</p>
                  <p className="truncate font-mono text-2xs text-fg-faint">{truncatePath(f.path, 4)}</p>
                </div>
                <span className="tnum shrink-0 text-2xs text-fg-muted">
                  {f.findings} findings · {formatDebt(f.debt)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-subtle pt-3">
          <p className="text-2xs text-fg-faint">
            Generated by CodeMentor AI · Semgrep, Checkmarx SAST, ESLint, SonarQube and CodeMentor
            review · 62.4s
          </p>
          <Link href="/reviews" className="text-2xs text-fg-secondary underline-offset-2 hover:underline no-print">
            Open in CodeMentor →
          </Link>
        </footer>
      </div>
    </div>
  );
}
