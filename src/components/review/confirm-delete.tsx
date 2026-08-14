"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/primitives";

/* ============================================================================
   Confirming a delete.

   ── WHY A DIALOG AND NOT A SECOND CLICK ──

   Every other action in this sidebar is undoable by doing the opposite. This
   one is not: there is no trash, and the file is gone from disk the moment the
   request returns. A modal is the only interruption strong enough to be worth
   putting in front of that, and it earns its place by saying three things a
   "are you sure?" does not:

     • the FULL PATH, monospaced. "Delete Settings.jsx?" is not enough on a
       tree with `Settings.jsx` and `SettingsPage.jsx` two rows apart.
     • what ELSE goes, for a folder — the file count. "Delete src?" and
       "Delete src and the 43 files in it?" are different questions.
     • that the user's VCS is the only undo, before they click, not after.

   The destructive button is NOT focused on open. Enter is the muscle-memory
   key for "yes, go on" and this is the one dialog where a reflex should not be
   enough.
   ========================================================================== */

export function ConfirmDelete({
  target,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  /** Null when closed. `fileCount` is null for a file, a number for a folder. */
  target: { path: string; fileCount: number | null } | null;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const isFolder = target?.fileCount !== null && target?.fileCount !== undefined;

  return (
    <Dialog.Root open={target !== null} onOpenChange={(open) => !open && !busy && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(0_0_0/0.5)]" />
        <Dialog.Content
          // Focus lands on Cancel, never on Delete.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            cancelRef.current?.focus();
          }}
          className={cn(
            "fixed left-1/2 top-[28vh] z-50 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2",
            "overflow-hidden rounded-xl border border-strong bg-elevated shadow-[var(--shadow-dialog)]"
          )}
        >
          <div className="flex gap-3 px-4 pb-3 pt-4">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-critical" aria-hidden />
            <div className="min-w-0">
              <Dialog.Title className="text-sm font-medium text-fg">
                Delete this {isFolder ? "folder" : "file"}?
              </Dialog.Title>

              <p className="mt-1.5 break-all font-mono text-2xs text-fg-secondary">
                {target?.path}
              </p>

              <Dialog.Description className="mt-2 text-2xs text-fg-muted">
                {isFolder && (target?.fileCount ?? 0) > 0
                  ? `This removes the folder and the ${target?.fileCount} file${
                      target?.fileCount === 1 ? "" : "s"
                    } inside it. `
                  : ""}
                This cannot be undone from here — your version control is the only way back.
              </Dialog.Description>

              {error ? (
                <p className="mt-2 text-2xs text-critical" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-subtle px-4 py-2.5">
            <Button ref={cancelRef} size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={onConfirm} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
