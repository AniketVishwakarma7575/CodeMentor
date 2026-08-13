"use client";

import * as React from "react";
import { FilePlus2, FolderPlus } from "lucide-react";
import type { FileNode } from "@/lib/types";
import { ApiError } from "@/lib/api/client";
import { createRepoEntry, deleteRepoEntry, renameRepoEntry } from "@/lib/api/repositories";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/primitives";
import { FileTree, type NewEntryKind, type TreeDraft } from "./file-tree";
import { ConfirmDelete } from "./confirm-delete";

/* ============================================================================
   The sidebar: header, tree, and everything in the product that WRITES to a
   user's folder.

   State lives here rather than in the tree because there are two ways in — the
   header buttons and the tree's right-click menu — and they must drive the same
   edit. Two independent "editing…" states is how you end up with a draft row
   and a rename row on screen at once, each unaware of the other.

   ── ONE EDIT AT A TIME ──

   `draft` and `renaming` are mutually exclusive, enforced by every entry point
   clearing the other. That is what lets `busy` and `error` be single values
   rather than a pair per operation, and it means a rejected rename cannot leave
   its error message hanging under an unrelated new-file row.
   ========================================================================== */

export function FileExplorer({
  nodes,
  selectedPath,
  onSelect,
  repoId,
  fileCount,
  filesTruncated,
  onCreated,
  onRenamed,
  onDeleted,
  className,
}: {
  nodes: FileNode[];
  selectedPath: string;
  onSelect: (path: string) => void;
  /** Null in fixture mode — no folder on disk, so no edit controls at all. */
  repoId: string | null;
  fileCount: number;
  filesTruncated: boolean;
  onCreated: (path: string, kind: NewEntryKind) => void;
  onRenamed: (from: string, to: string) => void;
  onDeleted: (path: string, findingsRemoved: number) => void;
  className?: string;
}) {
  const [draft, setDraft] = React.useState<TreeDraft | null>(null);
  const [renaming, setRenaming] = React.useState<FileNode | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<FileNode | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reset = React.useCallback(() => {
    setDraft(null);
    setRenaming(null);
    setError(null);
  }, []);

  const requestNew = React.useCallback(
    (parentPath: string, kind: NewEntryKind) => {
      reset();
      setDraft({ parentPath, kind });
    },
    [reset]
  );

  const requestRename = React.useCallback(
    (node: FileNode) => {
      reset();
      setRenaming(node);
    },
    [reset]
  );

  const requestDelete = React.useCallback(
    (node: FileNode) => {
      reset();
      setPendingDelete(node);
    },
    [reset]
  );

  /** Surface the server's own words — they name what to do next. */
  const explain = (err: unknown, fallback: string) =>
    setError(err instanceof ApiError ? err.message : fallback);

  /** Enter in the tree's name field. Which operation it is depends on the state. */
  const submitName = React.useCallback(
    async (name: string) => {
      if (!repoId || busy) return;
      if (!name) {
        reset(); // Enter on an untouched row means "never mind", not an error.
        return;
      }

      setBusy(true);
      setError(null);
      try {
        if (draft) {
          const path = draft.parentPath ? `${draft.parentPath}/${name}` : name;
          const created = await createRepoEntry(repoId, path, draft.kind);
          setDraft(null);
          onCreated(created.path, created.kind);
        } else if (renaming) {
          const parent = renaming.path.split("/").slice(0, -1).join("/");
          const to = parent ? `${parent}/${name}` : name;
          if (to === renaming.path) {
            reset();
            return;
          }
          const result = await renameRepoEntry(repoId, renaming.path, to);
          const from = renaming.path;
          setRenaming(null);
          onRenamed(from, result.path);
        }
      } catch (err) {
        explain(err, "Could not reach the API, so nothing was changed.");
      } finally {
        setBusy(false);
      }
    },
    [busy, draft, onCreated, onRenamed, renaming, repoId, reset]
  );

  const confirmDelete = React.useCallback(async () => {
    if (!repoId || !pendingDelete || busy) return;

    setBusy(true);
    setError(null);
    try {
      const result = await deleteRepoEntry(repoId, pendingDelete.path);
      const path = pendingDelete.path;
      setPendingDelete(null);
      onDeleted(path, result.findingsRemoved);
    } catch (err) {
      explain(err, "Could not reach the API, so nothing was deleted.");
    } finally {
      setBusy(false);
    }
  }, [busy, onDeleted, pendingDelete, repoId]);

  /** The header buttons target the folder the open file is in. */
  const currentDir = selectedPath.split("/").slice(0, -1).join("/");

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-subtle pl-2.5 pr-1.5">
        <span className="text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
          Files
        </span>

        <div className="flex items-center gap-0.5">
          {repoId ? (
            <>
              <HeaderAction
                label={currentDir ? `New file in ${currentDir}` : "New file"}
                onClick={() => requestNew(currentDir, "file")}
              >
                <FilePlus2 size={12} aria-hidden />
              </HeaderAction>
              <HeaderAction
                label={currentDir ? `New folder in ${currentDir}` : "New folder"}
                onClick={() => requestNew(currentDir, "directory")}
              >
                <FolderPlus size={12} aria-hidden />
              </HeaderAction>
            </>
          ) : null}

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
            <span className="tnum px-1 text-2xs text-fg-faint">
              {fileCount.toLocaleString()}
              {filesTruncated ? "+" : ""}
            </span>
          </Tooltip>
        </div>
      </div>

      <FileTree
        nodes={nodes}
        selectedPath={selectedPath}
        onSelect={onSelect}
        className="flex-1"
        draft={draft}
        renamingPath={renaming?.path ?? null}
        busy={busy}
        /* The delete dialog shows its own errors, so an error raised while it is
           open must not also print under a tree row behind it. */
        error={pendingDelete ? null : error}
        onRequestNew={repoId ? requestNew : undefined}
        onRequestRename={repoId ? requestRename : undefined}
        onRequestDelete={repoId ? requestDelete : undefined}
        onNameSubmit={submitName}
        onNameCancel={reset}
      />

      <ConfirmDelete
        target={
          pendingDelete
            ? {
                path: pendingDelete.path,
                // Null marks a file; a number marks a folder and is what makes
                // the dialog able to say what else goes with it.
                fileCount: pendingDelete.type === "dir" ? countFiles(pendingDelete) : null,
              }
            : null
        }
        busy={busy}
        error={error}
        onConfirm={confirmDelete}
        onCancel={() => {
          setPendingDelete(null);
          setError(null);
        }}
      />
    </div>
  );
}

/** Files anywhere beneath a node — what the delete dialog counts. */
function countFiles(node: FileNode): number {
  if (node.type === "file") return 1;
  return (node.children ?? []).reduce((sum, child) => sum + countFiles(child), 0);
}

function HeaderAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label} side="bottom">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-sm transition-colors duration-[120ms]",
          "text-fg-faint hover:bg-hover hover:text-fg"
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}
