"use client";

import * as React from "react";
import { ChevronRight, FileCode2, Folder, FolderOpen } from "lucide-react";
import type { FileNode, Severity } from "@/lib/types";
import { cn, severityMeta } from "@/lib/utils";
import { SeverityDot } from "@/components/severity";
import { Tooltip } from "@/components/ui/primitives";
import { ContextMenu, type MenuItem } from "./context-menu";

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

   ── EDITING ──

   Right-click a row for New File / New Folder / Rename / Delete, which is
   where a developer already expects to find them. Creating and renaming both
   happen IN THE TREE, at the right indentation, rather than in a dialog: the
   destination is the thing most likely to be got wrong, and showing the name in
   position answers "where is this going?" without asking anyone to read a path
   back to themselves.

   Deleting is the exception and gets a modal — see `ConfirmDelete` for why that
   one interruption is worth it.

   The parent of a new entry is the folder that was clicked, or — clicking a
   FILE — the folder that file is in. That is what every editor does, and it is
   why right-clicking `src/pages/Settings.jsx` offers to create a sibling rather
   than something inside a file.
   ========================================================================== */

const MAX_INDENT_LEVEL = 6;

export type NewEntryKind = "file" | "directory";

/** An in-progress creation: which folder, and what kind of thing. */
export interface TreeDraft {
  /** "" is the project root. */
  parentPath: string;
  kind: NewEntryKind;
}

export function FileTree({
  nodes,
  selectedPath,
  onSelect,
  className,
  draft = null,
  renamingPath = null,
  busy = false,
  error = null,
  onRequestNew,
  onRequestRename,
  onRequestDelete,
  onNameSubmit,
  onNameCancel,
}: {
  nodes: FileNode[];
  selectedPath: string;
  onSelect: (path: string) => void;
  className?: string;
  draft?: TreeDraft | null;
  /** The row being renamed in place. Mutually exclusive with `draft`. */
  renamingPath?: string | null;
  busy?: boolean;
  error?: string | null;
  /** All omitted in fixture mode — no folder on disk, so nothing to act on. */
  onRequestNew?: (parentPath: string, kind: NewEntryKind) => void;
  onRequestRename?: (node: FileNode) => void;
  onRequestDelete?: (node: FileNode) => void;
  onNameSubmit?: (name: string) => void;
  onNameCancel?: () => void;
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() =>
    defaultExpanded(nodes, selectedPath)
  );
  const [menu, setMenu] = React.useState<{
    x: number;
    y: number;
    parentPath: string;
    /** Null when the click landed on empty space — nothing to rename or delete. */
    node: FileNode | null;
  } | null>(null);

  /* Selecting a file in a real repository is a navigation, so the selection can
     also change from outside this component — a pasted URL, the back button.
     Either way the file has to be visible, which means its folders have to be
     open. Additive on purpose: folders the user collapsed by hand stay that
     way unless the selection moved inside one. */
  React.useEffect(() => {
    setExpanded((prev) => addAll(prev, ancestorsOf(selectedPath)));
  }, [selectedPath]);

  /* A draft inside a shut folder would be invisible, and the user would be
     typing into a row they cannot see. */
  const draftParent = draft?.parentPath;
  React.useEffect(() => {
    if (!draftParent) return;
    setExpanded((prev) => addAll(prev, [...ancestorsOf(draftParent), draftParent]));
  }, [draftParent]);

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const openMenu = onRequestNew
    ? (e: React.MouseEvent, parentPath: string, node: FileNode | null) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY, parentPath, node });
      }
    : undefined;

  const menuItems: MenuItem[] = React.useMemo(() => {
    if (!menu) return [];
    const run = (fn: () => void) => () => {
      fn();
      setMenu(null);
    };

    const items: MenuItem[] = [
      { label: "New File…", onSelect: run(() => onRequestNew?.(menu.parentPath, "file")) },
      { label: "New Folder…", onSelect: run(() => onRequestNew?.(menu.parentPath, "directory")) },
    ];

    /* Rename and Delete only when a ROW was clicked. Right-clicking empty space
       has no subject, and a Delete item with nothing selected is how the wrong
       thing gets deleted. */
    const node = menu.node;
    if (node) {
      if (onRequestRename) items.push({ label: "Rename…", onSelect: run(() => onRequestRename(node)) });
      if (onRequestDelete) {
        items.push({ label: "Delete", destructive: true, onSelect: run(() => onRequestDelete(node)) });
      }
    }

    return items;
  }, [menu, onRequestDelete, onRequestNew, onRequestRename]);

  const draftRow =
    draft && onNameSubmit && onNameCancel ? (
      <NameInput
        kind={draft.kind}
        busy={busy}
        error={error}
        onSubmit={onNameSubmit}
        onCancel={onNameCancel}
      />
    ) : null;

  const renameRow = (node: FileNode) =>
    onNameSubmit && onNameCancel ? (
      <NameInput
        kind={node.type === "dir" ? "directory" : "file"}
        initialValue={node.name}
        selectStem
        busy={busy}
        error={error}
        onSubmit={onNameSubmit}
        onCancel={onNameCancel}
      />
    ) : null;

  return (
    <div
      className={cn("min-h-0 overflow-y-auto overflow-x-hidden py-1", className)}
      role="tree"
      aria-label="Files"
      /* Right-clicking the empty space below the last row targets the project
         root — the only way to create a top-level file without first finding a
         root-level row to aim at. */
      onContextMenu={openMenu ? (e) => openMenu(e, "", null) : undefined}
    >
      {draft?.parentPath === "" ? <div style={{ paddingLeft: 6 }}>{draftRow}</div> : null}

      {nodes.map((n) => (
        <TreeRow
          key={n.path}
          node={n}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onContextMenu={openMenu}
          draft={draft}
          draftRow={draftRow}
          renamingPath={renamingPath}
          renameRow={renameRow}
        />
      ))}

      {menu ? (
        <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} items={menuItems} />
      ) : null}
    </div>
  );
}

/** Add every path to the set, returning the SAME set when nothing is missing. */
function addAll(prev: Set<string>, paths: string[]): Set<string> {
  const missing = paths.filter((p) => p && !prev.has(p));
  if (missing.length === 0) return prev; // No state change, no re-render.
  const next = new Set(prev);
  for (const p of missing) next.add(p);
  return next;
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
  onContextMenu,
  draft,
  draftRow,
  renamingPath,
  renameRow,
}: {
  node: FileNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (p: string) => void;
  selectedPath: string;
  onSelect: (p: string) => void;
  onContextMenu?: (e: React.MouseEvent, parentPath: string, node: FileNode | null) => void;
  draft: TreeDraft | null;
  draftRow: React.ReactNode;
  renamingPath: string | null;
  renameRow: (node: FileNode) => React.ReactNode;
}) {
  const isOpen = expanded.has(node.path);
  const pad = 6 + Math.min(depth, MAX_INDENT_LEVEL) * 11;

  /* A row being renamed is REPLACED by its input, not decorated with one. The
     old name sitting beside the field it is being changed in is the version of
     this that makes people wonder which one is live. */
  if (renamingPath === node.path) {
    return <div style={{ paddingLeft: pad }}>{renameRow(node)}</div>;
  }

  if (node.type === "dir") {
    const rollup = rollupSeverity(node);
    return (
      <>
        <button
          role="treeitem"
          aria-expanded={isOpen}
          onClick={() => onToggle(node.path)}
          // Right-clicking a FOLDER creates inside it.
          onContextMenu={onContextMenu ? (e) => onContextMenu(e, node.path, node) : undefined}
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
        {isOpen ? (
          <>
            {/* First, not in sorted position: the row is transient and unnamed,
                and hunting for where it will eventually sort is not something
                to ask of someone mid-keystroke. */}
            {draft?.parentPath === node.path ? (
              <div style={{ paddingLeft: 6 + Math.min(depth + 1, MAX_INDENT_LEVEL) * 11 }}>
                {draftRow}
              </div>
            ) : null}
            {node.children?.map((c) => (
              <TreeRow
                key={c.path}
                node={c}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
                draft={draft}
                draftRow={draftRow}
                renamingPath={renamingPath}
                renameRow={renameRow}
              />
            ))}
          </>
        ) : null}
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
        /* Right-clicking a FILE creates a SIBLING — the folder it lives in.
           Every editor does this, and the alternative is offering to create
           something inside a file. */
        onContextMenu={
          onContextMenu
            ? (e) => onContextMenu(e, node.path.split("/").slice(0, -1).join("/"), node)
            : undefined
        }
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

/**
 * The row being typed into — a new name, or a replacement for an existing one.
 *
 * One component for both because they are the same interaction: an icon, a
 * field, Enter to commit, Escape to abandon. The only difference is what it
 * starts with.
 *
 * The value is LOCAL. A field that round-trips every keystroke through the
 * component holding the API call re-renders the whole tree per character.
 */
function NameInput({
  kind,
  initialValue = "",
  selectStem = false,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  kind: NewEntryKind;
  initialValue?: string;
  /** Preselect the name without its extension, the way an editor does. */
  selectStem?: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState(initialValue);
  const ref = React.useRef<HTMLInputElement>(null);
  const selected = React.useRef(false);

  /* Focus on mount AND again when a failed attempt re-enables the field.
     Disabling an input blurs it, so without the second case a rejected name
     leaves the row open, showing its error, and not accepting typing — the
     user has to click back into a box they never left. */
  React.useEffect(() => {
    if (busy) return;
    const el = ref.current;
    if (!el) return;
    el.focus();

    // Once only: reselecting after a rejected name would wipe the correction
    // the user is halfway through typing.
    if (selectStem && !selected.current) {
      selected.current = true;
      const dot = initialValue.lastIndexOf(".");
      el.setSelectionRange(0, dot > 0 ? dot : initialValue.length);
    }
  }, [busy, initialValue, selectStem]);

  return (
    <div className="pr-2">
      <div className="flex h-[26px] items-center gap-1.5 pl-[14px]">
        {kind === "file" ? (
          <FileCode2 size={13} className="shrink-0 text-fg-faint" aria-hidden />
        ) : (
          <Folder size={13} className="shrink-0 text-fg-faint" aria-hidden />
        )}
        <input
          ref={ref}
          value={value}
          disabled={busy}
          spellCheck={false}
          autoComplete="off"
          aria-label={initialValue ? "New name" : kind === "file" ? "New file name" : "New folder name"}
          placeholder={kind === "file" ? "Billing.jsx" : "widgets"}
          onChange={(e) => setValue(e.target.value)}
          /* Blur abandons; it does not commit. An editor that writes to disk
             because the user clicked elsewhere is one that writes by accident,
             and retyping a name costs less than a stray file in someone's
             commit. */
          onBlur={() => !busy && onCancel()}
          onKeyDown={(e) => {
            // The workspace has a window-level j/k/a/x layer. Without this,
            // typing a filename triggers it.
            e.stopPropagation();
            if (e.key === "Enter") onSubmit(value.trim());
            if (e.key === "Escape") onCancel();
          }}
          className={cn(
            "h-[19px] min-w-0 flex-1 rounded-sm border bg-canvas px-1 font-mono text-2xs text-fg",
            "placeholder:text-fg-faint disabled:opacity-50",
            "focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]/25",
            error ? "border-critical" : "border-subtle focus:border-focus"
          )}
        />
      </div>
      {error ? (
        <p className="pb-1 pl-[14px] text-2xs text-critical" role="alert">
          {error}
        </p>
      ) : null}
    </div>
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
