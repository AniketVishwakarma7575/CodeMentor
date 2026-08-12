"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, FileCode2, Filter, RotateCcw, Undo2, X } from "lucide-react";
import type { TokenLine } from "@/lib/highlight";
import type { FileNode, Finding, RunStage, Severity } from "@/lib/types";
import { ApiError } from "@/lib/api/client";
import { USE_FIXTURES } from "@/lib/api/config";
import { applyFinding, setFindingStatus } from "@/lib/api/findings";
import { FINDINGS } from "@/data/findings";
import { FILE_TREE, REPO, RUN_DURATION_MS, RUN_STAGES, SCORE } from "@/data/repo";
import { ORDERS_LOC } from "@/data/source";
import { cn, severityMeta, truncatePath } from "@/lib/utils";
import { isTypingTarget } from "@/lib/shortcuts";
import { fade, pillPop } from "@/lib/motion";
import { Button, Chip, Kbd, Tooltip } from "@/components/ui/primitives";
import { SeverityGlyph } from "@/components/severity";
import { FileTree } from "./file-tree";
import { CodeViewer } from "./code-viewer";
import { FindingCard } from "./finding-card";
import { FileNotShown, NoFindings, NoSelection } from "./states";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

/**
 * How long a snooze lasts.
 *
 * The backend refuses a snooze with no end date, on the grounds that one is a
 * dismissal wearing a friendlier word. Two weeks is long enough to get a
 * release out and short enough that the finding comes back while the code is
 * still familiar.
 */
const SNOOZE_DAYS = 14;

/**
 * Everything that differs between a real run and the fixture screen.
 *
 * Defaulted rather than required so `NEXT_PUBLIC_USE_FIXTURES=true` still
 * renders the designed screen with no props — the fixtures are the offline and
 * design mode, not dead code.
 */
export interface ReviewSubject {
  findings?: Finding[];
  fileTree?: FileNode[];
  loc?: number;
  fileCount?: number;
  /** The server walk was cut short — `fileCount` is a floor, shown as "n+". */
  filesTruncated?: boolean;
  /** The run's stages, verbatim — the evidence behind "no findings here". */
  stages?: RunStage[];
  /** Wall-clock for the whole run. */
  runDurationMs?: number | null;
  score?: number;
  scoreDelta?: number;
  scoreBaseline?: string;
  /** Repo id — lets the workspace re-run analysis from the header. */
  repoId?: string;
}

export function ReviewWorkspace({
  sourceTokens,
  sourceFile,
  sourceUnavailable = false,
  fixTokens,
  initialFinding,
  initialFile,
  subject = {},
}: {
  sourceTokens: TokenLine[];
  /**
   * The path `sourceTokens` were highlighted from.
   *
   * Not the same thing as `initialFile`, and the difference is load-bearing:
   * the code pane holds exactly one file's tokens, so it may only be drawn
   * when the selected path is that file. In fixture mode only one file's
   * source is in the bundle, so this stays pinned to it while the tree
   * selection moves freely.
   */
  sourceFile: string;
  /**
   * `sourceFile` is in the tree but its bytes could not be shown — a binary, a
   * file over the size ceiling, or one deleted since the walk. Listing every
   * file in the project means the user can click these, and "cannot display"
   * is a far better answer than an empty pane or a failed page.
   */
  sourceUnavailable?: boolean;
  fixTokens: Record<string, TokenLine[]>;
  initialFinding: string | null;
  initialFile: string;
  subject?: ReviewSubject;
}) {
  const reduce = useReducedMotion();

  const fileTree = subject.fileTree ?? FILE_TREE;
  const loc = subject.loc ?? ORDERS_LOC;
  const fileCount = subject.fileCount ?? REPO.files;
  const filesTruncated = subject.filesTruncated ?? false;
  /* The fixture duration is keyed to the presence of fixture STAGES, not to
     `runDurationMs ?? …`. A real run that was cancelled before it finished has
     a null duration, and `??` would quietly dress it in the sample's 62s. */
  const stages = subject.stages ?? RUN_STAGES;
  const runDurationMs = subject.stages ? (subject.runDurationMs ?? null) : RUN_DURATION_MS;
  const overallScore = subject.score ?? SCORE.overall;
  const scoreDelta = subject.scoreDelta ?? SCORE.delta;
  const scoreBaseline = subject.scoreBaseline ?? SCORE.baseline;

  const [findings, setFindings] = React.useState<Finding[]>(subject.findings ?? FINDINGS);
  const [file, setFileState] = React.useState(initialFile);
  const [loadingFile, startFileLoad] = React.useTransition();
  const router = useRouter();

  /**
   * Selecting a file.
   *
   * With real data the source has to be fetched AND syntax-highlighted, both of
   * which happen on the server (Shiki must never enter the browser bundle), so
   * this is a real navigation. In fixture mode there is only one file's source
   * in the bundle, so it stays local state and the navigation would 404.
   *
   * Wrapped in a transition so the pane keeps showing the file it has while the
   * next one is fetched. Without it every click through the tree flashes an
   * empty state for the length of a round trip — which reads as "this file has
   * nothing in it" rather than "still loading".
   */
  const setFile = React.useCallback(
    (next: string) => {
      setFileState(next);
      if (!subject.repoId) return;
      const url = new URL(window.location.href);
      url.searchParams.set("file", next);
      url.searchParams.delete("finding");
      startFileLoad(() => router.push(`${url.pathname}${url.search}`));
    },
    [router, subject.repoId]
  );

  /* The server is the source of truth for which file is open: the back button
     and a pasted ?file= both arrive as a new prop, not as a click. */
  React.useEffect(() => setFileState(initialFile), [initialFile]);
  const [sevFilter, setSevFilter] = React.useState<Set<Severity>>(new Set());
  const [statusFilter, setStatusFilter] = React.useState<"open" | "all">("open");
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [revealDiffFor, setRevealDiffFor] = React.useState<string | null>(null);
  const [undo, setUndo] = React.useState<{ finding: Finding; label: string } | null>(null);
  /**
   * The reason a write was rejected, shown verbatim.
   *
   * The server's refusals are written for this reader — "line 41 has changed
   * since this was analysed", "this suggestion needs a judgement call" — and
   * each one names the next step. Replacing them with a generic failure toast
   * would throw away the only part of the error that helps.
   */
  const [error, setError] = React.useState<string | null>(null);

  /* ---- selection lives in the URL ----------------------------------------
     Every view in this product must be pasteable into a PR comment. The
     initial value arrives from the server; subsequent changes go through
     history.replaceState rather than the router, because j/k can fire several
     times a second and a router transition per keystroke is visible lag. */
  const [selectedId, setSelectedId] = React.useState<string | null>(initialFinding);

  const setSelected = React.useCallback((id: string | null) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("finding", id);
    else url.searchParams.delete("finding");
    window.history.replaceState(null, "", url);
  }, []);

  const categories = React.useMemo(
    () => Array.from(new Set(findings.map((f) => f.category))).sort(),
    [findings]
  );

  const visible = React.useMemo(
    () =>
      findings
        // The code pane shows ONE file, so a finding in another file would
        // point at a line the user cannot see. In fixture mode every finding is
        // already in the open file, so this changes nothing there.
        .filter((f) => f.file === file)
        .filter((f) => (statusFilter === "open" ? f.status === "open" || f.status === "applied" : true))
        .filter((f) => (sevFilter.size === 0 ? true : sevFilter.has(f.severity)))
        .filter((f) => (categoryFilter ? f.category === categoryFilter : true))
        .sort((a, b) => severityMeta[a.severity].rank - severityMeta[b.severity].rank || a.line - b.line),
    [findings, file, sevFilter, statusFilter, categoryFilter]
  );

  /** Open findings in other files — counted here, never summed off the stages. */
  const elsewhere = React.useMemo(
    () =>
      findings.filter(
        (f) => f.file !== file && f.status !== "dismissed" && f.status !== "snoozed"
      ).length,
    [findings, file]
  );

  /* ---- what the code pane is allowed to draw -----------------------------
     `sourceFile` is the file the tokens came from; `file` is the selection.
     They differ only while a navigation is in flight (stale) or, in fixture
     mode, whenever the tree points somewhere the bundle has no source for. */
  const isStale = loadingFile && file !== sourceFile;
  const showsSource = file === sourceFile || loadingFile;

  const selected = visible.find((f) => f.id === selectedId) ?? null;
  const counts = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of findings) {
      if (f.status === "dismissed" || f.status === "snoozed") continue;
      c[f.severity] = (c[f.severity] ?? 0) + 1;
    }
    return c;
  }, [findings]);

  /* ---- mutations ----------------------------------------------------------

     ── EVERY ACTION HERE PERSISTS, AND THAT IS NEW ──

     All three of these used to be `setFindings` and nothing else. "Apply fix"
     set `status: "applied"` in React state, rendered a green tick and the words
     "Fix applied", and left the file on disk untouched; dismiss and snooze
     vanished on reload. `setFindingStatus` existed in the API client the whole
     time with zero callers.

     The shape below is optimistic-then-reconcile, because triage is a
     keyboard-speed activity (j, k, x, s) and a round trip per keystroke is
     visible lag. The rule that makes optimism honest is that a REJECTED write
     must put the row back exactly as it was and say why — a silent revert is
     the same lie in a different direction.                                   */

  const mutate = React.useCallback(
    (id: string, patch: Partial<Finding>, undoLabel?: string) => {
      setFindings((prev) => {
        const before = prev.find((f) => f.id === id);
        if (before && undoLabel) setUndo({ finding: before, label: undoLabel });
        return prev.map((f) => (f.id === id ? { ...f, ...patch } : f));
      });
    },
    []
  );

  /** Put a finding back exactly as it was, and surface the server's reason. */
  const revert = React.useCallback((before: Finding, err: unknown) => {
    setFindings((prev) => prev.map((f) => (f.id === before.id ? before : f)));
    setUndo(null);
    setError(
      err instanceof ApiError
        ? err.message
        : "Could not reach the API, so nothing was changed."
    );
  }, []);

  /**
   * Apply the patch.
   *
   * ⚠️ In fixture mode this stays local — there is no repository on disk to
   *    write to, and the fixtures are the design surface. Everywhere else the
   *    server writes the file first and only then records the status, so a
   *    finding marked applied is one whose patch is really in the code.
   */
  const applyFix = React.useCallback(
    (id: string) => {
      const before = findings.find((f) => f.id === id);
      if (!before) return;

      setError(null);
      setRevealDiffFor(id);
      // ⚠️ Deliberately NO undo entry. Dismiss and snooze are status changes
      //    this app can take back; applying a fix edits a file on disk, and an
      //    "Undo" button that only flips a database row back to `open` would
      //    promise to un-write code it cannot un-write. The user's VCS is the
      //    undo here, and pretending otherwise is worse than offering nothing.
      mutate(id, { status: "applied" });
      window.setTimeout(() => setRevealDiffFor(null), 900);

      if (USE_FIXTURES) return;
      applyFinding(id)
        // Take the server's finding wholesale: it is the record of what was
        // actually written, and it may differ from the optimistic guess.
        .then((updated) => setFindings((prev) => prev.map((f) => (f.id === id ? updated : f))))
        .catch((err: unknown) => revert(before, err));
    },
    [findings, mutate, revert]
  );

  /** Move selection *before* removing the row, so focus never lands on nothing. */
  const removeAndAdvance = React.useCallback(
    (id: string, status: "dismissed" | "snoozed", label: string) => {
      const before = findings.find((f) => f.id === id);
      if (!before) return;

      const idx = visible.findIndex((f) => f.id === id);
      const next = visible[idx + 1] ?? visible[idx - 1] ?? null;
      setSelected(next?.id ?? null);
      setError(null);
      mutate(id, { status }, label);

      if (USE_FIXTURES) return;
      setFindingStatus(id, status, {
        // A snooze with no end is a dismissal in disguise — the backend rejects
        // one, so the duration is chosen here rather than left undefined.
        ...(status === "snoozed"
          ? { snoozeUntil: new Date(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000) }
          : {}),
      }).catch((err: unknown) => revert(before, err));
    },
    [findings, mutate, revert, setSelected, visible]
  );

  /**
   * Take back a dismiss or a snooze.
   *
   * Reopens on the server too. Without that the row would come back on screen
   * and go straight back to dismissed on the next load — which looks like the
   * undo silently failed, because it did.
   */
  const performUndo = React.useCallback(() => {
    if (!undo) return;
    const restored = undo.finding;
    setFindings((prev) => prev.map((f) => (f.id === restored.id ? restored : f)));
    setUndo(null);

    if (USE_FIXTURES) return;
    setFindingStatus(restored.id, restored.status).catch((err: unknown) => {
      setError(
        err instanceof ApiError
          ? `Could not reopen this finding — ${err.message}`
          : "Could not reach the API, so this finding is still dismissed on the server."
      );
    });
  }, [undo]);

  const step = React.useCallback(
    (dir: 1 | -1) => {
      if (visible.length === 0) return;
      const idx = visible.findIndex((f) => f.id === selectedId);
      const nextIdx = idx === -1 ? 0 : Math.min(Math.max(idx + dir, 0), visible.length - 1);
      setSelected(visible[nextIdx].id);
    },
    [selectedId, setSelected, visible]
  );

  /* ---- findings-scoped keyboard layer -------------------------------------
     Lives here, not in the shell, so `a` cannot "apply a fix" on a page where
     no finding exists. */
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === "z" && undo) {
          e.preventDefault();
          performUndo();
        }
        return;
      }
      if (isTypingTarget(e.target)) return;

      switch (e.key) {
        case "j":
          e.preventDefault();
          step(1);
          break;
        case "k":
          e.preventDefault();
          step(-1);
          break;
        case "a":
          // Mirrors the button's own condition: only a committable patch that
          // passed verification can be written, so `a` on a hand-apply
          // suggestion — or on one the verify stage rejected — must be a no-op
          // rather than a keystroke that fires a request the server refuses.
          if (
            selected?.fix &&
            selected.status !== "applied" &&
            !selected.verification.some((c) => c.state === "failed")
          ) {
            e.preventDefault();
            applyFix(selected.id);
          }
          break;
        case "e":
          if (selected) {
            e.preventDefault();
            setExpanded((v) => !v);
          }
          break;
        case "x":
          if (selected) {
            e.preventDefault();
            removeAndAdvance(selected.id, "dismissed", "Marked as not an issue");
          }
          break;
        case "s":
          if (selected) {
            e.preventDefault();
            removeAndAdvance(selected.id, "snoozed", "Snoozed");
          }
          break;
        case "1":
          e.preventDefault();
          setSevFilter(new Set<Severity>(["critical"]));
          break;
        case "2":
          e.preventDefault();
          setSevFilter(new Set<Severity>(["critical", "high"]));
          break;
        case "0":
          e.preventDefault();
          setSevFilter(new Set());
          setCategoryFilter(null);
          setStatusFilter("open");
          break;
        case "Escape":
          setSelected(null);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyFix, performUndo, removeAndAdvance, selected, setSelected, step, undo]);

  // Selection resets the expanded state — carrying it across findings means the
  // user opens a card already scrolled past the summary they wanted.
  React.useEffect(() => setExpanded(false), [selectedId]);

  const toggleSev = (s: Severity) =>
    setSevFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  return (
    <div className="flex h-full w-full flex-col">
      {/* ---- file header ---------------------------------------------------- */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-subtle bg-surface px-3">
        <FileCode2 size={13} className="shrink-0 text-fg-muted" aria-hidden />
        <h1 className="truncate font-mono text-sm text-fg">{file}</h1>
        <span className="tnum hidden shrink-0 font-mono text-2xs text-fg-faint sm:inline">
          {loc.toLocaleString()} lines
        </span>
        <span className="hidden items-center gap-1.5 pl-1 sm:flex">
          {SEVERITIES.filter((s) => counts[s]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <SeverityGlyph severity={s} size={9} />
              <span className="tnum text-2xs text-fg-muted">{counts[s]}</span>
            </span>
          ))}
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden text-2xs text-fg-muted lg:inline">
            Quality score{" "}
            <span className="tnum font-medium text-fg" data-metric>
              {overallScore}
            </span>
            {/* A zero delta is not a regression — rendering "−0" in critical red
                on a first-ever run reads as a failure that did not happen. */}
            {scoreDelta !== 0 ? (
              <span
                className="tnum"
                style={{
                  color: scoreDelta < 0 ? "var(--sev-critical-fg)" : "var(--sev-success-fg)",
                }}
              >
                {" "}
                {scoreDelta < 0 ? "−" : "+"}
                {Math.abs(scoreDelta)}
              </span>
            ) : null}{" "}
            <span className="text-fg-faint">vs {scoreBaseline}</span>
          </span>
          <Button variant="secondary" size="xs">
            <RotateCcw size={11} aria-hidden />
            Re-run
          </Button>
        </div>
      </div>

      <PanelGroup direction="horizontal" autoSaveId="cm-review-panes" className="min-h-0 flex-1">
        {/* ---- left: files + filters --------------------------------------- */}
        <Panel defaultSize={19} minSize={13} maxSize={32} className="hidden lg:flex">
          <div className="flex h-full min-h-0 w-full flex-col border-r border-subtle bg-surface">
            <div className="shrink-0 border-b border-subtle p-2">
              <div className="mb-1.5 flex items-center gap-1.5">
                <Filter size={11} className="text-fg-faint" aria-hidden />
                <span className="text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
                  Severity
                </span>
                {sevFilter.size > 0 || categoryFilter || statusFilter !== "open" ? (
                  <button
                    onClick={() => {
                      setSevFilter(new Set());
                      setCategoryFilter(null);
                      setStatusFilter("open");
                    }}
                    className="ml-auto text-2xs text-fg-muted hover:text-fg"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1">
                {SEVERITIES.map((s) => {
                  const n = counts[s] ?? 0;
                  const on = sevFilter.has(s);
                  return (
                    <button key={s} onClick={() => toggleSev(s)} disabled={n === 0} aria-pressed={on}>
                      {/* pillPop acknowledges the state flip. It is the one
                          micro-interaction here: without it a chip toggling
                          between two low-contrast greys is easy to miss. */}
                      <motion.span
                        className="block"
                        variants={reduce ? undefined : pillPop}
                        initial="idle"
                        animate={on ? "pop" : "idle"}
                      >
                        <Chip
                          active={on}
                          className={cn("cursor-pointer", n === 0 && "opacity-40")}
                        >
                          <SeverityGlyph severity={s} size={9} />
                          {severityMeta[s].label}
                          <span className="tnum text-fg-faint">{n}</span>
                        </Chip>
                      </motion.span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                <button onClick={() => setStatusFilter(statusFilter === "open" ? "all" : "open")}>
                  <Chip active={statusFilter === "all"} className="cursor-pointer">
                    {statusFilter === "open" ? "Open only" : "All statuses"}
                  </Chip>
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
                    aria-pressed={categoryFilter === c}
                  >
                    <Chip active={categoryFilter === c} className="cursor-pointer">
                      {c}
                    </Chip>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex h-7 shrink-0 items-center justify-between border-b border-subtle px-2.5">
              <span className="text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
                Files
              </span>
              {/* "+" when the server walk hit its ceiling. The count is then a
                  floor, and a flat number would claim the tree is complete. */}
              <Tooltip
                content={
                  filesTruncated
                    ? "The folder walk stopped at its file limit — more files exist than are listed."
                    : `${fileCount.toLocaleString()} files in this project`
                }
                side="left"
              >
                <span className="tnum text-2xs text-fg-faint">
                  {fileCount.toLocaleString()}
                  {filesTruncated ? "+" : ""}
                </span>
              </Tooltip>
            </div>

            <FileTree nodes={fileTree} selectedPath={file} onSelect={setFile} className="flex-1" />
          </div>
        </Panel>

        <ResizeHandle />

        {/* ---- center: code -------------------------------------------------
            The pane holds ONE file's tokens, so it may only draw itself when
            the selection is that file. While the next one is being fetched it
            keeps showing the current source, dimmed and un-annotated: the
            findings belong to the incoming file and would otherwise be pinned
            to whatever happens to be on those line numbers here. */}
        <Panel defaultSize={49} minSize={28}>
          {showsSource ? (
            <div
              className={cn("h-full transition-opacity duration-150", isStale && "opacity-50")}
              aria-busy={isStale || undefined}
            >
              {sourceUnavailable ? (
                <FileNotShown file={sourceFile} />
              ) : (
                <CodeViewer
                  tokens={sourceTokens}
                  findings={isStale ? [] : visible}
                  selectedId={isStale ? null : selectedId}
                  onSelect={setSelected}
                  filePath={sourceFile}
                  className="h-full"
                />
              )}
            </div>
          ) : (
            <div className="h-full bg-inset">
              <NoFindings
                file={truncatePath(file, 4)}
                stages={stages}
                durationMs={runDurationMs}
                elsewhere={elsewhere}
              />
            </div>
          )}
        </Panel>

        <ResizeHandle />

        {/* ---- right: detail ------------------------------------------------ */}
        <Panel defaultSize={32} minSize={22} maxSize={48} className="hidden xl:flex">
          <div className="flex h-full min-h-0 w-full flex-col border-l border-subtle bg-surface">
            <div className="flex h-8 shrink-0 items-center gap-2 border-b border-subtle px-3">
              <span className="text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
                Finding
              </span>
              {selected ? (
                <span className="tnum text-2xs text-fg-muted">
                  {visible.findIndex((f) => f.id === selected.id) + 1} of {visible.length}
                </span>
              ) : null}
              <span className="ml-auto flex items-center gap-1">
                <Tooltip content="Previous" shortcut="k">
                  <button
                    onClick={() => step(-1)}
                    className="flex h-5 w-5 items-center justify-center rounded-xs text-fg-faint hover:bg-hover hover:text-fg"
                    aria-label="Previous finding"
                  >
                    ↑
                  </button>
                </Tooltip>
                <Tooltip content="Next" shortcut="j">
                  <button
                    onClick={() => step(1)}
                    className="flex h-5 w-5 items-center justify-center rounded-xs text-fg-faint hover:bg-hover hover:text-fg"
                    aria-label="Next finding"
                  >
                    ↓
                  </button>
                </Tooltip>
              </span>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {selected ? (
                <motion.div
                  key={selected.id}
                  variants={reduce ? fade : undefined}
                  initial={reduce ? "hidden" : false}
                  animate={reduce ? "visible" : undefined}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <FindingCard
                    finding={selected}
                    fixTokens={fixTokens[selected.id]}
                    expanded={expanded}
                    onToggleExpand={() => setExpanded((v) => !v)}
                    onApply={() => applyFix(selected.id)}
                    onDismiss={() => removeAndAdvance(selected.id, "dismissed", "Marked as not an issue")}
                    onSnooze={() => removeAndAdvance(selected.id, "snoozed", "Snoozed")}
                    revealDiff={revealDiffFor === selected.id}
                  />
                </motion.div>
              ) : visible.length === 0 ? (
                <NoFindings file={file} stages={stages} durationMs={runDurationMs} elsewhere={elsewhere} />
              ) : (
                <NoSelection count={visible.length} />
              )}
            </AnimatePresence>
          </div>
        </Panel>
      </PanelGroup>

      {/* ---- a rejected write -------------------------------------------------
          Sits above the undo strip and outranks it: the row has already been
          put back, so what the reader needs now is the reason, in the server's
          own words. `alert` rather than `status` — this interrupts, because the
          thing the user just asked for did not happen. */}
      <AnimatePresence>
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            role="alert"
            className="pointer-events-auto fixed bottom-16 left-4 z-40 flex max-w-[440px] items-start gap-2 rounded-lg border border-critical-bd bg-critical-bg px-3 py-2 shadow-[var(--shadow-popover)]"
          >
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-critical-fg" aria-hidden />
            <p className="min-w-0 flex-1 text-sm leading-[1.45] text-critical-fg">{error}</p>
            <button
              onClick={() => setError(null)}
              aria-label="Dismiss"
              className="-mr-1 shrink-0 rounded-sm p-0.5 text-critical-fg/70 hover:bg-hover hover:text-critical-fg"
            >
              <X size={12} aria-hidden />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ---- undo ------------------------------------------------------------
          A destructive-feeling action needs a way back that is not the browser
          back button. Lives bottom-left so it never covers the action row. */}
      <AnimatePresence>
        {undo ? (
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            role="status"
            className="pointer-events-auto fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg border border-strong bg-elevated px-3 py-2 shadow-[var(--shadow-popover)]"
          >
            <span className="text-sm text-fg-secondary">{undo.label}</span>
            <Button variant="ghost" size="xs" onClick={performUndo}>
              <Undo2 size={11} aria-hidden />
              Undo
              <Kbd className="ml-0.5">⌘Z</Kbd>
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** 1px line that grows a 5px hit area. Precise to look at, easy to grab. */
function ResizeHandle() {
  return (
    <PanelResizeHandle className="group relative w-px shrink-0 bg-[var(--border-subtle)] outline-none data-[resize-handle-state=drag]:bg-[var(--border-focus)]">
      <span className="absolute inset-y-0 -left-[3px] -right-[3px] block" />
    </PanelResizeHandle>
  );
}
