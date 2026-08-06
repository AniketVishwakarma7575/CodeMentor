"use client";

import * as React from "react";
import { ChevronRight, FileCode2, Folder, FolderOpen } from "lucide-react";
import type { FileNode, Severity } from "@/lib/types";
import { cn, severityMeta } from "@/lib/utils";
import { SeverityDot } from "@/components/severity";
import { Tooltip } from "@/components/ui/primitives";

/* ============================================================================
   File tree.

   Two things break real file trees: depth and name length. Both are handled
   here rather than hoped away —
     • indentation is capped at 6 levels, so a 12-segment path stops pushing
       content off the right edge and starts scrolling instead;
     • names truncate at the row and carry the full path in a tooltip.
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
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  const toggle = (path: string) =>
    setCollapsed((prev) => {
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
          collapsed={collapsed}
          onToggle={toggle}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function TreeRow({
  node,
  depth,
  collapsed,
  onToggle,
  selectedPath,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (p: string) => void;
  selectedPath: string;
  onSelect: (p: string) => void;
}) {
  const isOpen = !collapsed.has(node.path);
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
          <span className="truncate text-sm text-fg-secondary">{node.name}</span>
          {rollup.count > 0 && !isOpen ? (
            <span className="ml-auto shrink-0">
              <SeverityDot severity={rollup.worst!} count={rollup.count} size={8} />
            </span>
          ) : null}
        </button>
        {isOpen
          ? node.children?.map((c) => (
              <TreeRow
                key={c.path}
                node={c}
                depth={depth + 1}
                collapsed={collapsed}
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
        <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
          {clean ? (
            <span className="text-2xs text-fg-faint" aria-label="No findings">
              —
            </span>
          ) : (
            <SeverityDot severity={node.worst!} count={node.findings} size={8} />
          )}
        </span>
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
