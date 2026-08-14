"use client";

import Link from "next/link";
import { AlertTriangle, FileQuestion, RotateCcw, ShieldCheck } from "lucide-react";
import type { RunStage } from "@/lib/types";
import { formatDuration, labelForEngine, pluralize } from "@/lib/utils";
import { Button, Eyebrow, Skeleton } from "@/components/ui/primitives";
import { StageGlyph } from "@/components/run/stage-glyph";

/* ============================================================================
   Empty state.

   "No issues found" is the moment the user decides whether to trust the tool.
   A blank page with a grey icon says "we did not look". So this state shows the
   *evidence*: what ran, how long it took, and what it did not manage to do.
   It reads as a verdict with a signature on it.

   ⚠️ EVERY ROW BELOW COMES FROM THE RUN. Same rule as ScoreLanding on the run
      screen, and for the same reason. This panel used to hardcode five engines
      with rule counts and timings — "Semgrep · 1,284 rules · 6.2s" — on a
      machine where Semgrep is very often not installed and the security stage
      came back DEGRADED. A fabricated proof-of-work is worse than no panel at
      all: it is the screen that asks for trust, lying.

      There is no `rules` count here because nothing in the pipeline reports
      one. An invented denominator is the exact thing this state existed to
      avoid.
   ========================================================================== */

export function NoFindings({
  file,
  stages = [],
  durationMs = null,
  elsewhere = 0,
  onRerun,
}: {
  file: string;
  /** The run's stages, verbatim. Empty renders the verdict without evidence. */
  stages?: RunStage[];
  /** Wall-clock for the whole run. */
  durationMs?: number | null;
  /**
   * Open findings in OTHER files, counted from the findings list.
   *
   * ⚠️ Not `stages.reduce((n, s) => n + s.findings)`. Stages report what each
   *    one contributed and `score` reports the post-dedupe total, so summing
   *    the column counts the same finding two or three times.
   */
  elsewhere?: number;
  onRerun?: () => void;
}) {
  const ran = stages.filter((s) => s.status !== "pending");
  const impaired = stages.filter((s) => s.status === "degraded" || s.status === "failed");

  return (
    <div className="flex h-full flex-col items-start justify-center px-8 py-10">
      <div className="w-full max-w-[440px]">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} style={{ color: "var(--sev-success)" }} aria-hidden />
          <h2 className="text-md font-medium text-fg">No findings in this file</h2>
        </div>

        {/* Scoped to the RUN, not to this file. The sidebar lists every file in
            the project, including ones no engine parses — a README cannot
            honestly be described as "analysed", so the claim stays at the level
            the data actually supports, and the caveat says the rest. */}
        <p className="mt-1.5 text-sm leading-[1.6] text-fg-secondary">
          Nothing in <span className="font-mono text-xs text-fg">{file}</span> was flagged by the
          run below
          {ran.length > 0 ? (
            <>
              {" "}
              — {pluralize(ran.length, "stage")}
              {durationMs != null ? <> in {formatDuration(durationMs)}</> : null}
              {elsewhere > 0 ? <>, which found {pluralize(elsewhere, "issue")} elsewhere</> : null}
            </>
          ) : null}
          .
        </p>

        {ran.length > 0 ? (
          <dl className="mt-4 divide-y divide-[var(--border-subtle)] rounded-lg border border-subtle bg-surface">
            {ran.map((s) => (
              <div key={s.id} className="flex min-h-8 items-center gap-2 px-3 py-1.5">
                <StageGlyph status={s.status} />
                <dt className="truncate text-sm text-fg-secondary">{s.label}</dt>
                {s.engine ? (
                  <span className="shrink-0 font-mono text-2xs text-fg-faint">
                    {labelForEngine(s.engine)}
                  </span>
                ) : null}
                <dd className="tnum ml-auto flex shrink-0 items-center gap-3 font-mono text-2xs text-fg-faint">
                  {s.findings > 0 ? <span>{s.findings} found</span> : null}
                  <span className="w-10 text-right">{formatDuration(s.durationMs)}</span>
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {/* "Not covered" is now a list of things that actually did not run, with
            the pipeline's own reason for each. The generic paragraph that used
            to live here was true of every static analyser ever written, which
            made it decoration; a missing Semgrep binary is actionable. */}
        <div className="mt-3 rounded-lg border border-subtle bg-canvas px-3 py-2.5">
          <Eyebrow>Not covered</Eyebrow>
          {impaired.length > 0 ? (
            <ul className="mt-1.5 space-y-1.5">
              {impaired.map((s) => (
                <li key={s.id} className="flex gap-2 text-sm leading-[1.5] text-fg-muted">
                  <AlertTriangle
                    size={11}
                    className="mt-[3px] shrink-0"
                    style={{ color: "var(--sev-medium)" }}
                    aria-hidden
                  />
                  <span>
                    <span className="text-fg-secondary">{s.label}</span>
                    {s.note ? <> — {s.note}</> : <> did not complete.</>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm leading-[1.5] text-fg-muted">
              Every stage completed. Runtime behaviour, third-party configuration, and code behind
              a flag that was off are still outside what any of them can see.
            </p>
          )}
          <p className="mt-2 text-2xs leading-[1.5] text-fg-faint">
            A file no engine parses — a README, a lockfile, an image — also shows nothing here.
            Absence of findings is not proof.
          </p>
        </div>

        {onRerun ? (
          <div className="mt-4 flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onRerun}>
              <RotateCcw size={12} aria-hidden />
              Re-run analysis
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/insights">See repository trend</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* -- file that cannot be rendered ------------------------------------------- */
/* The sidebar lists every file in the project, which means a PNG, a lockfile
   the size of a novel, and a file deleted since the scan are all one click
   away. Each of those is a normal thing to click and none of them is an error
   worth an error screen — so this says which case it is and stops there. */

export function FileNotShown({ file }: { file: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-inset px-8 text-center">
      <FileQuestion size={18} className="text-fg-faint" aria-hidden />
      <h2 className="mt-2.5 text-sm font-medium text-fg">This file cannot be shown</h2>
      <p className="mt-1.5 max-w-[380px] text-2xs leading-[1.6] text-fg-muted">
        <span className="font-mono text-fg-secondary">{file}</span> is binary, past the display
        size limit, or has changed since the project was scanned. It is listed because it is in
        the folder.
      </p>
    </div>
  );
}

/* -- nothing selected ------------------------------------------------------- */

export function NoSelection({ count }: { count: number }) {
  return (
    <div className="flex h-full flex-col items-start justify-center px-6">
      <p className="text-sm text-fg-secondary">
        {count} findings in this file.
      </p>
      <p className="mt-1 text-sm text-fg-muted">
        Pick one in the code, or press <kbd className="font-mono text-fg">j</kbd> to start at the
        most severe.
      </p>
    </div>
  );
}

/* -- error ------------------------------------------------------------------ */

export function AnalyzerError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex h-full flex-col items-start justify-center px-8">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} style={{ color: "var(--sev-high)" }} aria-hidden />
          <h2 className="text-md font-medium text-fg">Could not load this finding</h2>
        </div>
        <p className="mt-1.5 text-sm leading-[1.6] text-fg-secondary">
          The detail service returned <span className="font-mono text-xs">503</span> after 3
          attempts. The findings list is served from cache and is still accurate as of the last
          successful run.
        </p>
        <div className="mt-3 rounded-md border border-subtle bg-inset px-3 py-2 font-mono text-2xs leading-[1.6] text-fg-muted">
          <div>trace_id 9f2c14be-7ad0-4c11</div>
          <div>upstream findings-detail.prod</div>
          <div>last_ok 2026-08-06T09:14:22Z</div>
        </div>
        {onRetry ? (
          <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
            <RotateCcw size={12} aria-hidden />
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* -- loading ---------------------------------------------------------------- */
/* Shaped like the finding card it replaces: meta row, title, three columns,
   diff block, verification row. A spinner here would tell the user nothing. */

export function FindingSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading finding detail</span>
      <div className="border-b border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-[20px] w-16 rounded-sm" />
          <Skeleton className="h-[10px] w-20" />
          <Skeleton className="h-[10px] w-14" />
        </div>
        <Skeleton className="mt-2.5 h-4 w-[70%]" />
        <Skeleton className="mt-1.5 h-[10px] w-[45%]" />
      </div>
      <div className="grid grid-cols-1 border-b border-subtle xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5 px-4 py-3">
            <Skeleton className="h-[9px] w-16" />
            <Skeleton className="h-[11px] w-full" />
            <Skeleton className="h-[11px] w-[85%]" />
          </div>
        ))}
      </div>
      <div className="space-y-2 px-4 py-3">
        <Skeleton className="h-[9px] w-20" />
        <Skeleton className="h-[120px] w-full rounded-md" />
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[10px] w-20" />
          ))}
        </div>
      </div>
    </div>
  );
}
