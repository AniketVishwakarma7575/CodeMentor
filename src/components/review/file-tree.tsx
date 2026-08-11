"use client";

import * as React from "react";
import { ChevronRight, FileCode2, Folder, FolderOpen } from "lucide-react";
import type { FileNode, Severity } from "@/lib/types";
import { cn, severityMeta } from "@/lib/utils";
import { SeverityDot } from "@/components/severity";
import { Tooltip } from "@/components/ui/primitives";

/* ============================================================================
   File tree.

   This draws the WHOLE project, not just the files with findings, so three
   things that a short list could ignore are handled here rather than hoped
   away —
     • indentation is capped at 6 levels, so a 12-segment path stops pushing
       content off the right edge and starts scrolling instead;
     • names truncate at the row and carry the full path in a tooltip;
     • folders open by default only where there is a reason to look (see
       `defaultExpanded`). A twenty-thousand-file repository expanded on mount
       is both an unreadable wall and thousands of DOM nodes nobody asked for;
       collapsed, the rendered row count stays proportional to what the user
       has actually opened.
   ========================================================================== */

const MAX_INDENT_LEVEL = 6;

export function FileTree({
  nodes,
  selectedPath,
  onSelect,
  className,
}: {
  nodes: FileNode[];
  selectedPath: string;
  onSelect: (path: string) => void;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() =>
    defaultExpanded(nodes, selectedPath)
  );

  /* Selecting a file in a real repository is a navigation, so the selection can
     also change from outside this component — a pasted URL, the back button.
     Either way the file has to be visible, which means its folders have to be
     open. Additive on purpose: folders the user collapsed by hand stay that
     way unless the selection moved inside one. */
  React.useEffect(() => {
    setExpanded((prev) => {
      const missing = ancestorsOf(selectedPath).filter((d) => !prev.has(d));
      if (missing.length === 0) return prev; // No state change, no re-render.
      const next = new Set(prev);
      for (const d of missing) next.add(d);
      return next;
    });
  }, [selectedPath]);

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <div className={cn("min-h-0 overflow-y-auto overflow-x-hidden py-1", className)} role="tree" aria-label="Files">
      {nodes.map((n) => (
        <TreeRow
          key={n.path}
          node={n}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

/**
 * Which folders start open.
 *
 * Showing every file is the point; showing every file *expanded* is not. A
 * folder opens when there is something in it worth arriving at — a finding
 * somewhere below it, or the file that is already selected. Everything else
 * starts shut and is one click away.
 *
 * On the fixture tree, where nearly every file carries findings, this leaves
 * the designed screen exactly as it was.
 */
function defaultExpanded(nodes: FileNode[], selectedPath: string): Set<string> {
  const open = new Set<string>(ancestorsOf(selectedPath));

  const visit = (node: FileNode): boolean => {
    if (node.type === "file") return (node.findings ?? 0) > 0;
    let hasFindings = false;
    // Every child is visited — no short-circuit — because a nested folder that
    // holds findings must open too, not just the first branch that has one.
    for (const child of node.children ?? []) if (visit(child)) hasFindings = true;
    if (hasFindings) open.add(node.path);
    return hasFindings;
  };

  nodes.forEach(visit);
  return open;
}

/** Every directory path on the way to a file: a/b/c.js → ["a", "a/b"]. */
function ancestorsOf(path: string): string[] {
  const segments = path.split("/");
  const out: string[] = [];
  let walked = "";
  for (let i = 0; i < segments.length - 1; i++) {
    walked = walked ? `${walked}/${segments[i]}` : segments[i];
    out.push(walked);
  }
  return out;
}

function TreeRow({
  node,
  depth,
  expanded,
  onToggle,
  selectedPath,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (p: string) => void;
  selectedPath: string;
  onSelect: (p: string) => void;
}) {
  const isOpen = expanded.has(node.path);
  const pad = 6 + Math.min(depth, MAX_INDENT_LEVEL) * 11;

  if (node.type === "dir") {
    const rollup = rollupSeverity(node);
    return (
      <>
        <button
          role="treeitem"
          aria-expanded={isOpen}
          onClick={() => onToggle(node.path)}
          style={{ paddingLeft: pad }}
          className="flex h-[26px] w-full items-center gap-1.5 pr-2 text-left hover:bg-hover"
        >
          <ChevronRight
            size={12}
            aria-hidden
            className={cn("shrink-0 text-fg-faint transition-transform duration-[120ms]", isOpen && "rotate-90")}
          />
          {isOpen ? (
            <FolderOpen size={13} className="shrink-0 text-fg-faint" aria-hidden />
          ) : (
            <Folder size={13} className="shrink-0 text-fg-faint" aria-hidden />
          )}
          <span className="truncate text-sm text-fg-secondary" title={node.name}>
            {node.name}
          </span>
          {rollup.count > 0 && !isOpen ? (
            <span className="ml-auto shrink-0">
              <SeverityDot severity={rollup.worst!} count={rollup.count} size={8} />
            </span>
          ) : null}
        </button>
        {/* Children are not rendered while shut, not merely hidden — on a full
            project tree that is the difference between a few hundred rows and
            twenty thousand. */}
        {isOpen
          ? node.children?.map((c) => (
              <TreeRow
                key={c.path}
                node={c}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))
          : null}
      </>
    );
  }

  const selected = node.path === selectedPath;
  const clean = (node.findings ?? 0) === 0;

  return (
    <Tooltip content={<span className="font-mono text-2xs">{node.path}</span>} side="right">
      <button
        role="treeitem"
        aria-selected={selected}
        onClick={() => onSelect(node.path)}
        style={{ paddingLeft: pad + 14 }}
        className={cn(
          "flex h-[26px] w-full items-center gap-1.5 pr-2 text-left",
          selected ? "bg-selected" : "hover:bg-hover"
        )}
      >
        <FileCode2
          size={13}
          aria-hidden
          className={cn("shrink-0", selected ? "text-fg" : "text-fg-faint")}
        />
        <span className={cn("truncate text-sm", selected ? "text-fg" : "text-fg-secondary")}>
          {node.name}
        </span>
        {/* Nothing is drawn for a file without findings. The dash that used to
            sit here read as "analysed, clean" — a claim the tree cannot make
            now that it lists every file, including the README and the PNGs no
            engine ever opened. Absence of a mark means nothing to report. */}
        {clean ? null : (
          <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
            <SeverityDot severity={node.worst!} count={node.findings} size={8} />
          </span>
        )}
      </button>
    </Tooltip>
  );
}

function rollupSeverity(node: FileNode): { worst: Severity | null; count: number } {
  let worst: Severity | null = null;
  let count = 0;
  const walk = (n: FileNode) => {
    if (n.type === "file") {
      count += n.findings ?? 0;
      if (n.worst && (!worst || severityMeta[n.worst].rank < severityMeta[worst].rank)) worst = n.worst;
    }
    n.children?.forEach(walk);
  };
  walk(node);
  return { worst, count };
}
