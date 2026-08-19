"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ChevronDown, RotateCcw, Terminal, X } from "lucide-react";
import type { Finding, RunLogLine, RunStage } from "@/lib/types";
import { initialStages, subscribeToRun, TOTAL_MS, type RunEvent } from "@/lib/run-stream";
import { cancelRun, createRun, getRun, type RunDetail } from "@/lib/api/runs";
import { listRepositories, type RepositorySummary } from "@/lib/api/repositories";
import { useActiveProject } from "@/lib/active-project";
import { useActiveBranch } from "@/lib/active-branch";
import { USE_FIXTURES } from "@/lib/api/config";
import { REPO, SCORE } from "@/data/repo";
import { cn, formatDuration, labelForEngine, scoreColorVar, severityMeta } from "@/lib/utils";
import { countUp, expandCollapse, streamIn, transition } from "@/lib/motion";
import { Button, Eyebrow, Panel } from "@/components/ui/primitives";
import { SeverityGlyph } from "@/components/severity";
import { StageGlyph } from "./stage-glyph";

/* ============================================================================
   Run screen.

   40–90 seconds is far too long for a spinner. The design principle here: show
   the machine working, and let evidence accumulate. By the time the score
   lands, the user has already watched eight findings arrive with their rule
   ids attached — the number is a summary of something they saw happen, not an
   assertion they have to take on faith.
   ========================================================================== */

export function RunScreen({
  repoId = null,
  branch = null,
}: {
  repoId?: string | null;
  /**
   * Analyse this branch instead of the folder on disk.
   *
   * Null means the working tree, uncommitted changes included — the default,
   * because this tool is pointed at the folder you are working in. A branch is
   * checked out into a temporary worktree by the backend; nothing here (or
   * there) touches the user's own checkout.
   */
  branch?: string | null;
}) {
  const reduce = useReducedMotion();
  // The stored selection. Null until the effect that reads localStorage has
  // run, which is why the run is keyed on the target below rather than started
  // unconditionally on mount.
  const [activeProjectId, setActiveProject] = useActiveProject();

  /**
   * Which project this run analyses.
   *
   * ⚠️ `?repo=` WINS. This screen posts a run the moment it mounts, so the id
   *    it reads has to be the one the user just acted on. localStorage is a
   *    preference that survives navigation, tabs and reloads — trusting it here
   *    is what let a mount with a leftover selection re-analyse the previous
   *    project and file the result under its name, with nothing on screen
   *    disagreeing.
   *
   * The fallback stays for the entry points that carry no repo — the sidebar
   * and the command palette, where "run" means "the project I am working in".
   */
  const targetRepoId = repoId ?? activeProjectId;

  /**
   * Which branch to analyse.
   *
   * ⚠️ The URL wins, but a STORED selection is honoured when the URL is silent
   *    — and that fallback is what makes the top bar honest. The switcher
   *    persists the choice per project, so the header reads "repo / main" on
   *    every screen; landing on a bare `/runs` and analysing the working tree
   *    anyway produced a run subtitled "develop/v1 · working tree" underneath
   *    a header claiming `main`. Two different answers to "what am I looking
   *    at", on the same screen.
   */
  const [storedBranch] = useActiveBranch(targetRepoId);
  const targetBranch = branch ?? storedBranch;

  // An explicit URL is a selection, so the rest of the app should agree with
  // it — otherwise the picker and the review link keep pointing at whatever
  // was chosen last. Writing the same value back is a no-op, so this cannot
  // loop.
  React.useEffect(() => {
    if (repoId && repoId !== activeProjectId) setActiveProject(repoId);
  }, [repoId, activeProjectId, setActiveProject]);
  const [stages, setStages] = React.useState<RunStage[]>(initialStages);
  const [found, setFound] = React.useState<Finding[]>([]);
  const [logs, setLogs] = React.useState<RunLogLine[]>([]);
  const [done, setDone] = React.useState(false);
  const [cancelled, setCancelled] = React.useState(false);
  const [showLog, setShowLog] = React.useState(false);
  const [runKey, setRunKey] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  const [runId, setRunId] = React.useState<string | null>(null);
  /** The persisted run, fetched once `done` arrives. Authoritative for score. */
  const [runDetail, setRunDetail] = React.useState<RunDetail | null>(null);
  /** The project being analysed — for the header identity. */
  const [repo, setRepo] = React.useState<RepositorySummary | null>(null);
  /** Connection problem. `willRetry` means EventSource is already reconnecting. */
  const [connError, setConnError] = React.useState<{ message: string; willRetry: boolean } | null>(
    null
  );
  const stopRef = React.useRef<(() => void) | null>(null);

  /**
   * The POST for the run this screen is currently showing, keyed by what
   * identifies it.
   *
   * ⚠️ THE PROMISE, not a boolean. `createRun` is called from the effect body,
   *    so the request is already on the wire before any `disposed` flag can be
   *    read — a guard inside `.then` suppresses the SUBSCRIPTION, never the
   *    run. Under StrictMode that is exactly what happened: two POSTs, two
   *    server-side analyses, and an SSE stream attached to only the second.
   *    The first ran to completion unwatched, wrote its own findings, and
   *    raced the real run to become `/runs/latest`.
   *
   *    Holding the promise makes the second invocation REUSE the first one's
   *    request instead of issuing its own, so one mount is always one run
   *    while the surviving effect still gets a runId to subscribe to.
   */
  const startedRef = React.useRef<{ key: string; promise: Promise<{ runId: string }> } | null>(
    null
  );

  React.useEffect(() => {
    setStages(initialStages());
    setFound([]);
    setLogs([]);
    setDone(false);
    setCancelled(false);
    setConnError(null);
    setElapsed(0);
    setRunId(null);

    setRunDetail(null);

    const t0 = performance.now();
    const tick = window.setInterval(() => setElapsed(performance.now() - t0), 100);
    // Guards against a late async resolve writing state after unmount. It does
    // NOT stop a second run being started — see `startedRef` for that.
    let disposed = false;
    // Captured in the `done` handler, which closes over this effect and cannot
    // see the `runId` state set later in the same tick.
    let startedRunId: string | null = null;

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
          // Fetch the authoritative record. The `done` event carries a score,
          // but the gate, rating and real wall-clock duration live on the run —
          // and this card must never render a number the database disagrees
          // with.
          if (startedRunId) {
            void getRun(startedRunId)
              .then((detail) => {
                if (!disposed) setRunDetail(detail);
              })
              .catch(() => {
                /* The stream already told us it finished; the card degrades to
                   the streamed score rather than showing an error. */
              });
          }
        }
      },
      onError: (err: { message: string; willRetry: boolean }) => setConnError(err),
    };

    if (USE_FIXTURES) {
      stopRef.current = subscribeToRun("fixture", handlers);
    } else if (!targetRepoId) {
      // Nothing to analyse. Say so rather than firing a request that can only
      // fail — "no project selected" is a state the user can act on, and a
      // network error is not.
      setConnError({
        message: "No project selected. Connect a folder on the Repositories page first.",
        willRetry: false,
      });
      window.clearInterval(tick);
    } else {
      // Everything that makes this a DIFFERENT run. `runKey` covers "Analyse
      // again", which re-runs the same target on purpose.
      const key = `${runKey} ${targetRepoId} ${targetBranch ?? ""}`;

      let started = startedRef.current;
      if (!started || started.key !== key) {
        started = {
          key,
          promise: createRun({
            mode: "local",
            repoId: targetRepoId,
            ...(targetBranch ? { branch: targetBranch } : {}),
          }),
        };
        startedRef.current = started;
      }

      void started.promise
        .then((run) => {
          if (disposed) return;
          startedRunId = run.runId;
          setRunId(run.runId);
          stopRef.current = subscribeToRun(run.runId, handlers);
        })
        .catch((err: Error) => {
          if (disposed) return;
          // A failed POST must not be retried silently on the next invocation
          // against a promise that can only reject again.
          if (startedRef.current?.key === key) startedRef.current = null;
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
    // `targetRepoId` is a dependency, not just a read: with no `?repo=` it
    // resolves through localStorage one tick after mount, and without it here
    // the first render's null would permanently latch the "no project
    // selected" branch. With a `?repo=` it is correct on the first render and
    // never changes, so the run fires once.
    //
    // `branch` is a dependency for the same reason it is a URL parameter:
    // changing it means analysing different code, which is a different run.
  }, [runKey, targetRepoId, targetBranch]);

  /**
   * Which project this run is about.
   *
   * Fetched separately from the run because the header must be correct from the
   * first frame — waiting for the run to finish before naming the repository
   * would leave "Analysing" with no subject for the whole run.
   */
  React.useEffect(() => {
    if (USE_FIXTURES || !targetRepoId) return;
    let disposed = false;
    void listRepositories()
      .then((all) => {
        if (!disposed) setRepo(all.find((r) => r.id === targetRepoId) ?? null);
      })
      .catch(() => {
        /* The subtitle degrades to the branch alone. Not worth an error state. */
      });
    return () => {
      disposed = true;
    };
  }, [targetRepoId]);

  /**
   * `repo · branch · commit`.
   *
   * In fixture mode this is the sample project. With a real run it must be the
   * real one: the header previously always read the `REPO` fixture, so a run
   * over a local folder announced itself as "acme/checkout-service ·
   * feat/order-search · e91c4ad" — a repository that does not exist.
   */
  const subtitle = USE_FIXTURES
    ? `${REPO.name} · ${REPO.branch} · ${REPO.commit}`
    : [
        repo?.name ?? "Project",
        runDetail?.branch ?? targetBranch ?? repo?.branch,
        // `commitSha` is the literal string "local" for a working-tree run,
        // because the files on disk match no commit. Spelling that out beats
        // printing "local" as though it were a SHA — and a branch run has a
        // real one, which is the whole difference between the two.
        runDetail?.commitSha === "local"
          ? "working tree"
          : runDetail?.commitSha?.slice(0, 7),
      ]
        .filter(Boolean)
        .join(" · ");

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
              {subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* While running this is an ESTIMATE (the fixture simulator's
                3.2× scale). Once the run lands, the database's real wall-clock
                replaces it — a screen that keeps showing the estimate after the
                fact is reporting a number nothing produced. */}
            <span className="tnum text-sm text-fg-secondary" data-metric>
              {formatDuration(runDetail?.durationMs ?? Math.round(elapsed * 3.2))}
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
                {/* Carry the repo through — /reviews with no ?repo renders the
                    fixture review, which after a real run is the wrong screen. */}
                <Link href={targetRepoId ? `/reviews?repo=${targetRepoId}` : "/reviews"}>
                  Open review
                </Link>
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
                ? `Analysis complete. ${totalFindings} findings. Quality score ${runDetail?.score ?? SCORE.overall} out of 100.`
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
                  <ScoreLanding run={USE_FIXTURES ? null : runDetail} />
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
                /*
                 * ⚠️ ITS OWN SCROLL REGION, CAPPED.
                 *
                 * This list is appended to live as the run streams, and it used
                 * to grow without limit — so a real analysis pushed the page to
                 * several thousand pixels and the pipeline, the score and the
                 * stage notes scrolled off the top exactly while they were the
                 * things worth watching. It got much worse when SonarJS, jscpd
                 * and Gitleaks landed: a run that used to report a handful of
                 * findings now routinely reports dozens.
                 *
                 * Viewport-relative rather than a fixed pixel height, because
                 * the pipeline section above it is itself tall — a fixed cap
                 * that looks right on a desktop leaves nothing visible on a
                 * laptop. `min()` keeps it from becoming absurd on a large
                 * display.
                 *
                 * `overscroll-contain` stops a flick at the end of the list
                 * from chaining into the page scroll underneath, which reads as
                 * the whole screen jumping.
                 *
                 * Same idiom as the raw log above — see `max-h-[220px]`.
                 */
                <ul className="max-h-[min(560px,55vh)] overflow-y-auto overscroll-contain">
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

/* -- score ------------------------------------------------------------------ */

/**
 * ⚠️ EVERY NUMBER HERE MUST COME FROM THE RUN THAT JUST FINISHED.
 *
 * This card previously read the `SCORE` fixture, so a real run that scored 100
 * with a passing gate rendered "34/100 · Quality gate failed · 4 of 5
 * conditions". The score is the one number this product asks users to trust;
 * showing a fabricated failing gate over a real passing run is worse than
 * showing nothing, because it is confidently wrong.
 */
function ScoreLanding({ run }: { run: RunDetail | null }) {
  const reduce = useReducedMotion();

  // Fixture mode keeps the designed sample card. With a real run and no score
  // yet (cancelled, or failed before scoring) we render nothing rather than a
  // zero — 0/100 is a verdict, and "we did not get that far" is not.
  const overall = run ? run.score : SCORE.overall;
  const [value, setValue] = React.useState(reduce ? (overall ?? 0) : 0);

  React.useEffect(() => {
    if (overall === null) return;
    return countUp(0, overall, (v) => setValue(v), { duration: 0.4, reduced: !!reduce });
  }, [reduce, overall]);

  if (overall === null) return null;

  const gate = run ? run.gate : SCORE.gate;
  const passed = gate?.conditions.filter((c) => c.status === "passed").length ?? 0;
  const total = gate?.conditions.length ?? 0;
  const baseline = run ? run.branch : SCORE.baseline;
  const delta = run ? 0 : SCORE.delta;

  return (
    <div className="rounded-lg border border-subtle bg-surface p-3">
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-1">
          <span
            className="tnum text-2xl font-semibold leading-none"
            data-metric
            style={{ color: scoreColorVar(overall) }}
          >
            {Math.round(value)}
          </span>
          <span className="text-sm text-fg-faint">/100</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm text-fg">
            {/* A first run has nothing to compare against. "−0 against main" on
                a brand-new project reads as a regression that never happened. */}
            {delta !== 0 ? (
              <>
                <span
                  className="tnum"
                  style={{
                    color: delta < 0 ? "var(--sev-critical-fg)" : "var(--sev-success-fg)",
                  }}
                >
                  {delta < 0 ? "−" : "+"}
                  {Math.abs(delta)}
                </span>{" "}
                against {baseline}
              </>
            ) : (
              <span className="text-fg-secondary">on {baseline}</span>
            )}
          </p>
          <p className="text-2xs text-fg-muted">
            {gate
              ? `Quality gate ${gate.status} · ${passed} of ${total} conditions`
              : "No quality gate evaluated"}
          </p>
        </div>
      </div>
    </div>
  );
}
