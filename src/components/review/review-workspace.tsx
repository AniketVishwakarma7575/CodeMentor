"use client";

import * as React from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FileCode2, Filter, RotateCcw, Undo2 } from "lucide-react";
import type { TokenLine } from "@/lib/highlight";
import type { Finding, Severity } from "@/lib/types";
import { FINDINGS } from "@/data/findings";
import { FILE_TREE, REPO, SCORE } from "@/data/repo";
import { ORDERS_LOC } from "@/data/source";
import { cn, severityMeta, truncatePath } from "@/lib/utils";
import { isTypingTarget } from "@/lib/shortcuts";
import { fade, pillPop } from "@/lib/motion";
import { Button, Chip, Kbd, Tooltip } from "@/components/ui/primitives";
import { SeverityGlyph } from "@/components/severity";
import { FileTree } from "./file-tree";
import { CodeViewer } from "./code-viewer";
import { FindingCard } from "./finding-card";
import { NoFindings, NoSelection } from "./states";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

export function ReviewWorkspace({
  sourceTokens,
  fixTokens,
  initialFinding,
  initialFile,
}: {
  sourceTokens: TokenLine[];
  fixTokens: Record<string, TokenLine[]>;
  initialFinding: string | null;
  initialFile: string;
}) {
  const reduce = useReducedMotion();

  const [findings, setFindings] = React.useState<Finding[]>(FINDINGS);
  const [file, setFile] = React.useState(initialFile);
  const [sevFilter, setSevFilter] = React.useState<Set<Severity>>(new Set());
  const [statusFilter, setStatusFilter] = React.useState<"open" | "all">("open");
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [revealDiffFor, setRevealDiffFor] = React.useState<string | null>(null);
  const [undo, setUndo] = React.useState<{ finding: Finding; label: string } | null>(null);

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
        .filter((f) => (statusFilter === "open" ? f.status === "open" || f.status === "applied" : true))
        .filter((f) => (sevFilter.size === 0 ? true : sevFilter.has(f.severity)))
        .filter((f) => (categoryFilter ? f.category === categoryFilter : true))
        .sort((a, b) => severityMeta[a.severity].rank - severityMeta[b.severity].rank || a.line - b.line),
    [findings, sevFilter, statusFilter, categoryFilter]
  );

  const selected = visible.find((f) => f.id === selectedId) ?? null;
  const counts = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of findings) {
      if (f.status === "dismissed" || f.status === "snoozed") continue;
      c[f.severity] = (c[f.severity] ?? 0) + 1;
    }
    return c;
  }, [findings]);

  /* ---- mutations ---------------------------------------------------------- */

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

  const applyFix = React.useCallback(
    (id: string) => {
      setRevealDiffFor(id);
      mutate(id, { status: "applied" }, "Fix applied");
      window.setTimeout(() => setRevealDiffFor(null), 900);
    },
    [mutate]
  );

  /** Move selection *before* removing the row, so focus never lands on nothing. */
  const removeAndAdvance = React.useCallback(
    (id: string, status: "dismissed" | "snoozed", label: string) => {
      const idx = visible.findIndex((f) => f.id === id);
      const next = visible[idx + 1] ?? visible[idx - 1] ?? null;
      setSelected(next?.id ?? null);
      mutate(id, { status }, label);
    },
    [mutate, setSelected, visible]
  );

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
          setFindings((prev) => prev.map((f) => (f.id === undo.finding.id ? undo.finding : f)));
          setUndo(null);
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
          if (selected?.fix && selected.status !== "applied") {
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
  }, [applyFix, removeAndAdvance, selected, setSelected, step, undo]);

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
          {ORDERS_LOC.toLocaleString()} lines
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
              {SCORE.overall}
            </span>
            <span className="tnum text-critical-fg"> −{Math.abs(SCORE.delta)}</span>{" "}
            <span className="text-fg-faint">vs {SCORE.baseline}</span>
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
              <span className="tnum text-2xs text-fg-faint">{REPO.files}</span>
            </div>

            <FileTree nodes={FILE_TREE} selectedPath={file} onSelect={setFile} className="flex-1" />
          </div>
        </Panel>

        <ResizeHandle />

        {/* ---- center: code ------------------------------------------------- */}
        <Panel defaultSize={49} minSize={28}>
          {file === "src/routes/orders.js" ? (
            <CodeViewer
              tokens={sourceTokens}
              findings={visible}
              selectedId={selectedId}
              onSelect={setSelected}
              filePath={file}
              className="h-full"
            />
          ) : (
            <div className="h-full bg-inset">
              <NoFindings file={truncatePath(file, 4)} />
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
                <NoFindings file={file} />
              ) : (
                <NoSelection count={visible.length} />
              )}
            </AnimatePresence>
          </div>
        </Panel>
      </PanelGroup>

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
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setFindings((prev) => prev.map((f) => (f.id === undo.finding.id ? undo.finding : f)));
                setUndo(null);
              }}
            >
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
