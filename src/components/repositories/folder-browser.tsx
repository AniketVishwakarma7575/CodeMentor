"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronRight,
  CornerLeftUp,
  Folder,
  FolderGit2,
  HardDrive,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { ApiError } from "@/lib/api/client";
import {
  browseLocal,
  connectLocalFolder,
  type BrowseResult,
  type DirEntry,
  type RepositorySummary,
} from "@/lib/api/repositories";
import { overlayVariants, paletteVariants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/primitives";

/* ============================================================================
   Folder browser.

   The browser cannot give a server a real path — `webkitdirectory` yields
   relative names and a sandboxed handle, and any "path" the user pastes is just
   a string. So the SERVER enumerates, and this dialog is a thin view over
   GET /repositories/local/browse.

   Two ways in, because both are how people actually work:
     • click down through the tree
     • paste a path they already have in a terminal
   ========================================================================== */

export function FolderBrowser({
  open,
  onOpenChange,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConnected: (repo: RepositorySummary) => void;
}) {
  const reduce = useReducedMotion();

  const [listing, setListing] = React.useState<BrowseResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [manualPath, setManualPath] = React.useState("");

  /**
   * Guards against a slow browse resolving after a faster later one and
   * overwriting it — click three folders quickly and the list would otherwise
   * settle on whichever request happened to finish last.
   */
  const requestSeq = React.useRef(0);

  const load = React.useCallback(async (path?: string) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await browseLocal(path);
      if (seq !== requestSeq.current) return;
      setListing(result);
      setManualPath(result.path);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(messageFor(err));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  // Start at the home directory each time the dialog opens.
  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const connect = React.useCallback(
    async (path: string) => {
      setConnecting(true);
      setError(null);
      try {
        const repo = await connectLocalFolder(path);
        onConnected(repo);
        onOpenChange(false);
      } catch (err) {
        setError(messageFor(err));
      } finally {
        setConnecting(false);
      }
    },
    [onConnected, onOpenChange]
  );

  const current = listing?.path ?? "";
  const busy = loading || connecting;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-[rgb(0_0_0/0.5)]"
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild forceMount>
              <motion.div
                variants={reduce ? overlayVariants : paletteVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(
                  "fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2",
                  "overflow-hidden rounded-xl border border-strong bg-elevated shadow-[var(--shadow-dialog)]"
                )}
              >
                <Dialog.Title className="border-b border-subtle px-4 py-3 text-sm font-medium text-fg">
                  Connect a local folder
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  Browse this machine and pick a project folder to analyse.
                </Dialog.Description>

                {/* Drive shortcuts. Windows has several; POSIX has one. */}
                {listing && listing.roots.length > 1 ? (
                  <div className="flex items-center gap-1 border-b border-subtle px-3 py-1.5">
                    {listing.roots.map((root) => (
                      <button
                        key={root}
                        onClick={() => void load(root)}
                        disabled={busy}
                        className={cn(
                          "flex h-6 items-center gap-1 rounded-sm border px-1.5 font-mono text-2xs",
                          current.startsWith(root)
                            ? "border-strong bg-active text-fg"
                            : "border-subtle text-fg-muted hover:bg-hover hover:text-fg"
                        )}
                      >
                        <HardDrive size={10} aria-hidden />
                        {root.replace(/[\\/]+$/, "")}
                      </button>
                    ))}
                  </div>
                ) : null}

                {/* Paste-a-path. Enter browses; the button connects directly. */}
                <div className="flex items-center gap-1.5 border-b border-subtle px-3 py-2">
                  <input
                    value={manualPath}
                    onChange={(e) => setManualPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && manualPath.trim()) {
                        e.preventDefault();
                        void load(manualPath.trim());
                      }
                    }}
                    spellCheck={false}
                    aria-label="Folder path"
                    placeholder="D:\CodeMetor_AI_Tools\codementor-backend"
                    className={cn(
                      "h-7 min-w-0 flex-1 rounded-md border border-subtle bg-canvas px-2 font-mono text-xs text-fg",
                      "placeholder:text-fg-faint hover:border-strong focus:border-focus focus:outline-none"
                    )}
                  />
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={busy || !manualPath.trim()}
                    onClick={() => void load(manualPath.trim())}
                  >
                    Open
                  </Button>
                </div>

                {/* Listing */}
                <div className="h-[280px] overflow-y-auto p-1">
                  {loading && !listing ? (
                    <Centered>
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                      Reading folders…
                    </Centered>
                  ) : error && !listing ? (
                    <Centered tone="critical">
                      <TriangleAlert size={14} aria-hidden />
                      {error}
                    </Centered>
                  ) : listing ? (
                    <>
                      {listing.parent ? (
                        <Row
                          icon={<CornerLeftUp size={13} className="text-fg-faint" aria-hidden />}
                          label=".."
                          mono
                          disabled={busy}
                          onClick={() => void load(listing.parent!)}
                        />
                      ) : null}

                      {listing.entries.length === 0 ? (
                        <Centered>No sub-folders here.</Centered>
                      ) : (
                        listing.entries.map((entry) => (
                          <FolderRow
                            key={entry.path}
                            entry={entry}
                            disabled={busy}
                            onOpen={() => void load(entry.path)}
                            onConnect={() => void connect(entry.path)}
                          />
                        ))
                      )}
                    </>
                  ) : null}
                </div>

                {/* Footer — connect the folder currently open. */}
                <div className="flex items-center gap-2 border-t border-subtle px-3 py-2">
                  <p className="min-w-0 flex-1 truncate font-mono text-2xs text-fg-muted" title={current}>
                    {error && listing ? (
                      <span className="text-critical-fg">{error}</span>
                    ) : (
                      current || "—"
                    )}
                  </p>
                  <Dialog.Close asChild>
                    <Button size="xs" variant="ghost" disabled={connecting}>
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <Button
                    size="xs"
                    variant="primary"
                    disabled={busy || !current}
                    onClick={() => void connect(current)}
                  >
                    {connecting ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
                    Connect this folder
                  </Button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}

/* -- rows ------------------------------------------------------------------- */

/**
 * A folder row does two different things, so it has two hit targets: the row
 * navigates INTO the folder, the trailing button connects it. Collapsing those
 * into one click means you can never open a git repo to check you have the
 * right one before connecting it.
 */
function FolderRow({
  entry,
  disabled,
  onOpen,
  onConnect,
}: {
  entry: DirEntry;
  disabled: boolean;
  onOpen: () => void;
  onConnect: () => void;
}) {
  return (
    <div className="group flex items-center gap-1 rounded-md pr-1 hover:bg-hover">
      <button
        onClick={onOpen}
        disabled={disabled}
        className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left disabled:opacity-40"
      >
        {entry.isRepo ? (
          <FolderGit2 size={13} className="shrink-0 text-fg-secondary" aria-hidden />
        ) : (
          <Folder size={13} className="shrink-0 text-fg-faint" aria-hidden />
        )}
        <span className="truncate text-sm text-fg">{entry.name}</span>
        {entry.isRepo ? (
          <span className="shrink-0 rounded-sm border border-subtle px-1 text-2xs text-fg-muted">
            git
          </span>
        ) : null}
        <ChevronRight size={12} className="ml-auto shrink-0 text-fg-faint" aria-hidden />
      </button>
      <Button
        size="xs"
        variant="quiet"
        disabled={disabled}
        onClick={onConnect}
        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        Connect
      </Button>
    </div>
  );
}

function Row({
  icon,
  label,
  mono,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  mono?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-hover disabled:opacity-40"
    >
      {icon}
      <span className={cn("truncate text-sm text-fg-secondary", mono && "font-mono")}>{label}</span>
    </button>
  );
}

function Centered({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "critical";
}) {
  return (
    <div
      className={cn(
        "flex h-full items-center justify-center gap-2 px-6 text-center text-sm",
        tone === "critical" ? "text-critical-fg" : "text-fg-muted"
      )}
    >
      {children}
    </div>
  );
}

/**
 * The backend's error `message` is written to be shown to a user verbatim —
 * every rejection from `assertSafeDir` names the thing to change. Falling back
 * to a generic string would throw that away.
 */
function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "LOCAL_REPOS_DISABLED" || err.code === "LOCAL_REPOS_REMOTE_DENIED") {
      return err.message;
    }
    return err.message;
  }
  return "Something went wrong reading that folder.";
}
