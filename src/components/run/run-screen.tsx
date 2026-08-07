"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  RotateCcw,
  Terminal,
  X,
} from "lucide-react";
import type { Finding, RunLogLine, RunStage } from "@/lib/types";
import { initialStages, subscribeToRun, TOTAL_MS, type RunEvent } from "@/lib/run-stream";
import { cancelRun, createRun } from "@/lib/api/runs";
import { USE_FIXTURES } from "@/lib/api/config";
import { REPO, SCORE } from "@/data/repo";
import { cn, formatDuration, labelForEngine, scoreColorVar, severityMeta } from "@/lib/utils";
import { countUp, expandCollapse, streamIn, transition } from "@/lib/motion";
import { Button, Eyebrow, Panel } from "@/components/ui/primitives";
import { SeverityGlyph } from "@/components/severity";

/* ============================================================================
   Run screen.

   40–90 seconds is far too long for a spinner. The design principle here: show
   the machine working, and let evidence accumulate. By the time the score
   lands, the user has already watched eight findings arrive with their rule
   ids attached — the number is a summary of something they saw happen, not an
   assertion they have to take on faith.
   ========================================================================== */

export function RunScreen() {
  const reduce = useReducedMotion();
  const [stages, setStages] = React.useState<RunStage[]>(initialStages);
  const [found, setFound] = React.useState<Finding[]>([]);
  const [logs, setLogs] = React.useState<RunLogLine[]>([]);
  const [done, setDone] = React.useState(false);
  const [cancelled, setCancelled] = React.useState(false);
  const [showLog, setShowLog] = React.useState(false);
  const [runKey, setRunKey] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  const [runId, setRunId] = React.useState<string | null>(null);
  /** Connection problem. `willRetry` means EventSource is already reconnecting. */
  const [connError, setConnError] = React.useState<{ message: string; willRetry: boolean } | null>(
    null
  );
  const stopRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    setStages(initialStages());
    setFound([]);
    setLogs([]);
    setDone(false);
    setCancelled(false);
    setConnError(null);
    setElapsed(0);
    setRunId(null);

    const t0 = performance.now();
    const tick = window.setInterval(() => setElapsed(performance.now() - t0), 100);
    // Guards against a late async resolve writing state after unmount, and
    // against StrictMode's double-invoke starting two runs in development.
    let disposed = false;

    const handlers = {
      onEvent: (e: RunEvent) => {
        if (e.type === "stage" && e.stage) {
          setStages((prev) => prev.map((s) => (s.id === e.stage!.id ? { ...s, ...e.stage! } : s)));
        } else if (e.type === "finding" && e.finding) {
          // Dedupe: an SSE reconnect replays events the client already saw.
          setFound((prev) =>
            prev.some((f) => f.id === e.finding!.id) ? prev : [...prev, e.finding!]
          );
        } else if (e.type === "log" && e.log) {
          setLogs((prev) => [...prev, e.log!]);
        } else if (e.type === "done") {
          setDone(true);
          setConnError(null);
          window.clearInterval(tick);
        }
      },
      onError: (err: { message: string; willRetry: boolean }) => setConnError(err),
    };

    if (USE_FIXTURES) {
      stopRef.current = subscribeToRun("fixture", handlers);
    } else {
      void createRun({ mode: "snippet", source: "// paste code here", language: "javascript" })
        .then((run) => {
          if (disposed) return;
          setRunId(run.runId);
          stopRef.current = subscribeToRun(run.runId, handlers);
        })
        .catch((err: Error) => {
          if (disposed) return;
          setConnError({ message: err.message, willRetry: false });
          window.clearInterval(tick);
        });
    }

    return () => {
      disposed = true;
      stopRef.current?.();
      stopRef.current = null;
      window.clearInterval(tick);
    };
  }, [runKey]);

  const totalFindings = found.length;
  const activeStage = stages.find((s) => s.status === "active");
  const degraded = stages.filter((s) => s.status === "degraded");
  const progress = Math.min(100, (elapsed * 3.2) / TOTAL_MS * 100);

  function cancel() {
    stopRef.current?.();
    setCancelled(true);
    // Stop the stream locally AND tell the server, so the sandbox actually
    // stops burning CPU. A cancel that only closes the EventSource is not a
    // cancel — the run keeps going and keeps costing money.
    if (runId && !USE_FIXTURES) {
      void cancelRun(runId).catch(() => {
        /* already finished or gone — nothing to do */
      });
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-6 py-5">
        {/* ---- header ------------------------------------------------------ */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-[-0.011em] text-fg">
              {cancelled ? "Run cancelled" : done ? "Analysis complete" : "Analysing"}
            </h1>
            <p className="mt-0.5 truncate font-mono text-2xs text-fg-muted">
              {REPO.name} · {REPO.branch} · {REPO.commit}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="tnum text-sm text-fg-secondary" data-metric>
              {formatDuration(Math.round(elapsed * 3.2))}
            </span>
            {done || cancelled ? (
              <Button variant="secondary" size="sm" onClick={() => setRunKey((k) => k + 1)}>
                <RotateCcw size={12} aria-hidden />
                Run again
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={cancel}>
                <X size={12} aria-hidden />
                Cancel
              </Button>
            )}
            {done ? (
              <Button variant="primary" size="sm" asChild>
                <Link href="/reviews">Open review</Link>
              </Button>
            ) : null}
          </div>
        </div>

        {/* Screen-reader users get the progress narrated, not the animation. */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {cancelled
            ? "Run cancelled."
            : connError && !connError.willRetry
              ? `Connection failed. ${connError.message}`
              : done
                ? `Analysis complete. ${totalFindings} findings. Quality score ${SCORE.overall} out of 100.`
                : `${activeStage?.label ?? "Starting"}. ${totalFindings} findings so far.`}
        </div>

        {/* ---- top-level progress ------------------------------------------ */}
        <div className="mt-3 h-[2px] w-full overflow-hidden rounded-xs bg-active">
          <div
            className="h-full transition-[width] duration-200 ease-linear"
            style={{
              width: `${cancelled ? progress : done ? 100 : progress}%`,
              background: done ? "var(--sev-success)" : "var(--text-secondary)",
            }}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          {/* ---- pipeline -------------------------------------------------- */}
          <section>
            <Eyebrow>Pipeline</Eyebrow>
            <ol className="mt-1.5">
              {stages.map((stage, i) => (
                <StageRow key={stage.id} stage={stage} last={i === stages.length - 1} />
              ))}
            </ol>

            {/* ---- connection state ------------------------------------------
                A dropped SSE connection is a first-class state, not a silent
                stall. `willRetry` distinguishes "reconnecting" (amber, the
                browser is already retrying) from "gone" (red, fatal) — a
                spinner that never resolves teaches users the tool is broken. */}
            {connError ? (
              <div
                role="status"
                className={cn(
                  "mt-3 rounded-lg border px-3 py-2",
                  connError.willRetry
                    ? "border-medium-bd bg-medium-bg"
                    : "border-critical-bd bg-critical-bg"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <AlertTriangle
                    size={12}
                    className={connError.willRetry ? "text-medium-fg" : "text-critical-fg"}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "text-2xs font-medium",
                      connError.willRetry ? "text-medium-fg" : "text-critical-fg"
                    )}
                  >
                    {connError.message}
                  </span>
                </div>
                {!connError.willRetry ? (
                  <button
                    onClick={() => setRunKey((k) => k + 1)}
                    className="mt-1.5 text-2xs text-fg-secondary underline-offset-2 hover:underline"
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            ) : null}

            {degraded.length > 0 ? (
              <div className="mt-3 rounded-lg border border-medium-bd bg-medium-bg px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-medium-fg" aria-hidden />
                  <span className="text-2xs font-medium text-medium-fg">
                    {degraded.length === 1 ? "1 stage degraded" : `${degraded.length} stages degraded`}
                  </span>
                </div>
                {degraded.map((s) => (
                  <p key={s.id} className="mt-1 text-2xs leading-[1.5] text-fg-secondary">
                    <span className="text-fg">{s.label}:</span> {s.note}
                  </p>
                ))}
              </div>
            ) : null}

            {/* ---- score ---------------------------------------------------- */}
            <AnimatePresence>
              {done ? (
                <motion.div
                  initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={transition.element}
                  className="mt-4"
                >
                  <ScoreLanding />
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* ---- raw log -------------------------------------------------- */}
            <div className="mt-4 overflow-hidden rounded-lg border border-subtle bg-surface">
              <button
                onClick={() => setShowLog((v) => !v)}
                aria-expanded={showLog}
                className="flex h-8 w-full items-center gap-1.5 px-3 text-left text-sm text-fg-secondary hover:bg-hover"
              >
                <Terminal size={12} aria-hidden />
                Raw output
                <span className="tnum ml-auto text-2xs text-fg-faint">{logs.length} lines</span>
                <ChevronDown
                  size={12}
                  aria-hidden
                  className={cn("transition-transform duration-[180ms]", showLog && "rotate-180")}
                />
              </button>
              <AnimatePresence initial={false}>
                {showLog ? (
                  <motion.div
                    variants={expandCollapse}
                    initial="collapsed"
                    animate="expanded"
                    exit="collapsed"
                    className="overflow-hidden border-t border-subtle"
                  >
                    <div className="max-h-[220px] overflow-auto bg-inset p-2">
                      {logs.map((l, i) => (
                        <div key={i} className="flex gap-2 whitespace-pre font-mono text-2xs leading-[16px]">
                          <span className="tnum shrink-0 text-[var(--code-line-number)]">
                            {(l.t / 1000).toFixed(2).padStart(6)}
                          </span>
                          <span
                            className={cn(
                              "w-9 shrink-0 uppercase",
                              l.level === "error"
                                ? "text-critical-fg"
                                : l.level === "warn"
                                  ? "text-medium-fg"
                                  : "text-fg-faint"
                            )}
                          >
                            {l.level}
                          </span>
                          <span className="text-fg-secondary">{l.message}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </section>

          {/* ---- findings as they arrive ------------------------------------ */}
          <section className="min-w-0">
            <div className="flex items-baseline gap-2">
              <Eyebrow>Findings</Eyebrow>
              <span className="tnum text-2xs text-fg-muted" data-metric>
                {totalFindings} so far
              </span>
            </div>

            <Panel className="mt-1.5 overflow-hidden">
              {totalFindings === 0 ? (
                <p className="px-3 py-6 text-sm text-fg-muted">
                  Nothing yet. Findings appear here the moment an analyzer reports one.
                </p>
              ) : (
                <ul>
                  <AnimatePresence initial={false}>
                    {found.map((f) => (
                      <motion.li
                        key={f.id}
                        variants={reduce ? undefined : streamIn}
                        initial={reduce ? { opacity: 0 } : "hidden"}
                        animate={reduce ? { opacity: 1 } : "visible"}
                        className="border-b border-subtle last:border-0"
                      >
                        <Link
                          href={`/reviews?finding=${f.id}`}
                          className="flex h-11 items-center gap-2.5 px-3 hover:bg-hover"
                        >
                          <SeverityGlyph severity={f.severity} size={12} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-fg">{f.title}</p>
                            <p className="tnum truncate font-mono text-2xs text-fg-faint">
                              {severityMeta[f.severity].label} · {f.ruleKey} · {f.file}:{f.line}
                            </p>
                          </div>
                          <span className="hidden shrink-0 text-2xs text-fg-muted sm:block">
                            {labelForEngine(f.engine)}
                          </span>
                        </Link>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </Panel>
          </section>
        </div>
      </div>
    </div>
  );
}

/* -- stage row -------------------------------------------------------------- */

function StageRow({ stage, last }: { stage: RunStage; last: boolean }) {
  const active = stage.status === "active";

  return (
    <li className="relative flex gap-2.5">
      {/* rail */}
      <div className="relative flex w-4 shrink-0 justify-center">
        <StageGlyph status={stage.status} />
        {!last ? (
          <span
            aria-hidden
            className="absolute left-1/2 top-[18px] h-[calc(100%-18px)] w-px -translate-x-1/2"
            style={{
              background:
                stage.status === "complete" || stage.status === "degraded"
                  ? "var(--border-strong)"
                  : "var(--border-subtle)",
            }}
          />
        ) : null}
      </div>

      <div className={cn("min-w-0 flex-1 pb-3", last && "pb-0")}>
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "truncate text-sm",
              stage.status === "pending" ? "text-fg-faint" : "text-fg"
            )}
          >
            {stage.label}
          </span>
          {stage.engine ? (
            <span className="hidden shrink-0 font-mono text-2xs text-fg-faint sm:inline">
              {labelForEngine(stage.engine)}
            </span>
          ) : null}
          <span className="tnum ml-auto shrink-0 font-mono text-2xs text-fg-muted">
            {stage.findings > 0 ? `${stage.findings} found · ` : ""}
            {formatDuration(stage.durationMs)}
          </span>
        </div>

        {/* Indeterminate treatment: a 30%-wide sliver sweeping the track. It
            masks latency and does not lie about how far along we are. */}
        {active ? (
          <div className="relative mt-1.5 h-[2px] w-full overflow-hidden rounded-xs bg-active">
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-[30%] rounded-xs bg-[var(--text-secondary)] motion-safe:animate-[cm-indeterminate_1.15s_cubic-bezier(0.4,0,0.2,1)_infinite]"
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}

function StageGlyph({ status }: { status: RunStage["status"] }) {
  if (status === "complete") {
    return (
      <span className="z-10 flex h-4 w-4 items-center justify-center rounded-full bg-canvas">
        <Check size={12} style={{ color: "var(--sev-success)" }} aria-hidden />
        <span className="sr-only">Complete</span>
      </span>
    );
  }
  if (status === "degraded") {
    return (
      <span className="z-10 flex h-4 w-4 items-center justify-center rounded-full bg-canvas">
        <AlertTriangle size={11} style={{ color: "var(--sev-medium)" }} aria-hidden />
        <span className="sr-only">Degraded</span>
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="z-10 flex h-4 w-4 items-center justify-center rounded-full bg-canvas">
        <X size={12} style={{ color: "var(--sev-critical)" }} aria-hidden />
        <span className="sr-only">Failed</span>
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="z-10 flex h-4 w-4 items-center justify-center rounded-full bg-canvas">
        <span className="h-[7px] w-[7px] rounded-full bg-[var(--text-primary)]" />
        <span className="sr-only">Running</span>
      </span>
    );
  }
  return (
    <span className="z-10 flex h-4 w-4 items-center justify-center rounded-full bg-canvas">
      <span className="h-[6px] w-[6px] rounded-full border border-[var(--border-strong)]" />
      <span className="sr-only">Pending</span>
    </span>
  );
}

/* -- score ------------------------------------------------------------------ */

function ScoreLanding() {
  const reduce = useReducedMotion();
  const [value, setValue] = React.useState(reduce ? SCORE.overall : 0);

  React.useEffect(() => {
    return countUp(0, SCORE.overall, (v) => setValue(v), { duration: 0.4, reduced: !!reduce });
  }, [reduce]);

  return (
    <div className="rounded-lg border border-subtle bg-surface p-3">
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-1">
          <span
            className="tnum text-2xl font-semibold leading-none"
            data-metric
            style={{ color: scoreColorVar(SCORE.overall) }}
          >
            {Math.round(value)}
          </span>
          <span className="text-sm text-fg-faint">/100</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm text-fg">
            <span className="tnum text-critical-fg">−{Math.abs(SCORE.delta)}</span> against{" "}
            {SCORE.baseline}
          </p>
          <p className="text-2xs text-fg-muted">Quality gate failed · 4 of 5 conditions</p>
        </div>
      </div>
    </div>
  );
}
