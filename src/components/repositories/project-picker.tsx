"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Folder, FolderGit2, Plus, Search, X } from "lucide-react";
import type { RepositorySummary } from "@/lib/api/repositories";
import { cn } from "@/lib/utils";

/* ============================================================================
   Project picker.

   Search · list · check on the active one · add · opt out. The last row matters
   as much as the others: "no active project" is a real state, not the absence
   of a choice, and without an explicit way back to it the only escape from a
   project is picking a different one.
   ========================================================================== */

export function ProjectPicker({
  projects,
  activeId,
  onSelect,
  onAddLocal,
  loading,
}: {
  projects: RepositorySummary[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onAddLocal: () => void;
  loading?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  // Reset the filter on close so reopening never shows a stale search.
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.localPath ?? "").toLowerCase().includes(q)
    );
  }, [projects, query]);

  const active = projects.find((p) => p.id === activeId) ?? null;

  const choose = (id: string | null) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "flex h-7 min-w-0 max-w-[280px] items-center gap-1.5 rounded-md border border-subtle px-2",
            "text-sm text-fg hover:bg-hover focus-visible:border-focus focus-visible:outline-none"
          )}
        >
          <Folder size={13} className="shrink-0 text-fg-muted" aria-hidden />
          <span className={cn("truncate", active ? "text-fg" : "text-fg-muted")}>
            {active ? active.name : "No project"}
          </span>
          <ChevronDown size={12} className="shrink-0 text-fg-faint" aria-hidden />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={5}
          className="z-50 w-[300px] overflow-hidden rounded-lg border border-strong bg-elevated shadow-[var(--shadow-popover)]"
        >
          <div className="flex items-center gap-1.5 border-b border-subtle px-2.5 py-1.5">
            <Search size={12} className="shrink-0 text-fg-faint" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
              className="h-6 min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-faint focus:outline-none"
            />
          </div>

          <ul className="max-h-[260px] overflow-y-auto p-1">
            {loading ? (
              <li className="px-2 py-3 text-center text-xs text-fg-muted">Loading…</li>
            ) : filtered.length === 0 ? (
              <li className="px-2 py-3 text-center text-xs text-fg-muted">
                {projects.length === 0 ? "No projects connected yet." : "No match."}
              </li>
            ) : (
              filtered.map((p) => {
                const Icon = p.provider === "local" ? Folder : FolderGit2;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => choose(p.id)}
                      // A folder from another machine can be listed but not
                      // opened — selecting it would put the app in a state
                      // where every action fails with ENOENT.
                      disabled={!p.available}
                      title={p.available ? p.localPath ?? p.name : "Connected on a different machine"}
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left",
                        "hover:bg-hover disabled:pointer-events-none disabled:opacity-40"
                      )}
                    >
                      <Icon size={13} className="shrink-0 text-fg-muted" aria-hidden />
                      <span className="truncate text-sm text-fg">{p.name}</span>
                      {p.provider === "local" && p.localPath ? (
                        <span className="truncate text-2xs text-fg-faint">
                          {shortenPath(p.localPath)}
                        </span>
                      ) : null}
                      <Check
                        size={13}
                        className={cn(
                          "ml-auto shrink-0",
                          p.id === activeId ? "text-fg" : "text-transparent"
                        )}
                        aria-hidden
                      />
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-subtle p-1">
            <button
              onClick={() => {
                setOpen(false);
                onAddLocal();
              }}
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-fg-secondary hover:bg-hover hover:text-fg"
            >
              <Plus size={13} className="shrink-0" aria-hidden />
              Connect local folder
            </button>
            <button
              onClick={() => choose(null)}
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-fg-muted hover:bg-hover hover:text-fg"
            >
              <X size={13} className="shrink-0" aria-hidden />
              Don&apos;t work in a project
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Parent folder only — the project name is already the row's label. */
function shortenPath(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : path;
}
