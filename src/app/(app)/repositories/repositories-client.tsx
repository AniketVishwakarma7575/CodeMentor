"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Folder,
  FolderGit2,
  GitBranch,
  Loader2,
  MonitorOff,
  Play,
  Plus,
  RefreshCw,
  TriangleAlert,
  Unlink,
} from "lucide-react";
import { useActiveProject } from "@/lib/active-project";
import {
  disconnectRepository,
  rescanRepository,
  type RepositorySummary,
} from "@/lib/api/repositories";
import { removeRepository, upsertRepository, useRepositories } from "@/lib/repositories-store";
import { cn, labelForEngine, ratingColorVar, ratingFromScore, scoreColorVar } from "@/lib/utils";
import { Button, Eyebrow } from "@/components/ui/primitives";
import { FolderBrowser } from "@/components/repositories/folder-browser";
import { ProjectPicker } from "@/components/repositories/project-picker";

/* ============================================================================
   Repositories.

   Local folders and hosted repos are one list, sorted together, drawn by the
   same row component. The provider is a 13px icon and nothing more — a screen
   that splits them into "Local" and "GitHub" sections makes the user think
   about a distinction that does not affect anything they can do here.
   ========================================================================== */

export function RepositoriesClient() {
  const [browserOpen, setBrowserOpen] = React.useState(false);
  const [activeId, setActiveId] = useActiveProject();
  const router = useRouter();

  // The shared store, not local state: this screen is the one that EDITS the
  // list, and the top bar's project switcher reads the same store. A private
  // copy here is why a freshly connected folder never showed up in the
  // switcher until the next full page load.
  const { repos, loading, error, refresh } = useRepositories();

  const onConnected = React.useCallback(
    (repo: RepositorySummary) => {
      // Insert locally rather than refetching — the response is authoritative
      // and a round-trip here would make the new row appear a beat late.
      upsertRepository(repo);
      setActiveId(repo.id);
    },
    [setActiveId]
  );

  const onDisconnected = React.useCallback(
    (id: string) => {
      removeRepository(id);
      // Clearing the selection matters: leaving activeId pointing at a deleted
      // repo puts the picker in a state with no visible checkmark and no
      // obvious way to understand why.
      if (activeId === id) setActiveId(null);
    },
    [activeId, setActiveId]
  );

  const onUpdated = React.useCallback((repo: RepositorySummary) => {
    upsertRepository(repo);
  }, []);

  /**
   * Make a project active and hand off to the run screen, which is what
   * actually starts the analysis — see the note on RepoRow.analyse.
   */
  const analyse = React.useCallback(
    (id: string) => {
      setActiveId(id);
      // The id goes in the URL as well as the store. The run screen posts a run
      // on mount, and `setActiveId` writes localStorage asynchronously from
      // that screen's point of view — the URL is the only carrier that is
      // guaranteed correct on its first render.
      router.push(`/runs?repo=${encodeURIComponent(id)}`);
    },
    [router, setActiveId]
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1000px] px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold tracking-[-0.011em] text-fg">Repositories</h1>
            <p className="mt-0.5 text-sm text-fg-muted">
              {loading
                ? "Loading…"
                : `${repos.length} connected · local folders analysed on demand`}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <ProjectPicker
              projects={repos}
              activeId={activeId}
              onSelect={setActiveId}
              onAddLocal={() => setBrowserOpen(true)}
              loading={loading}
            />
            <Button size="sm" variant="primary" onClick={() => setBrowserOpen(true)}>
              <Plus size={13} aria-hidden />
              Connect folder
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-critical-bd bg-critical-bg px-3 py-2 text-sm text-critical-fg">
            <TriangleAlert size={13} className="shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">{error}</span>
            <Button size="xs" variant="ghost" onClick={() => void refresh()}>
              Retry
            </Button>
          </div>
        ) : null}

        <Eyebrow className="mt-4 block">Connected</Eyebrow>

        {loading ? (
          <ul className="mt-1.5 divide-y divide-[var(--border-subtle)] rounded-lg border border-subtle bg-surface">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex h-[52px] items-center px-3">
                <span className="h-3 w-40 rounded-sm bg-hover" aria-hidden />
              </li>
            ))}
          </ul>
        ) : repos.length === 0 ? (
          <EmptyState onAddLocal={() => setBrowserOpen(true)} />
        ) : (
          <ul className="mt-1.5 divide-y divide-[var(--border-subtle)] rounded-lg border border-subtle bg-surface">
            {repos.map((repo) => (
              <RepoRow
                key={repo.id}
                repo={repo}
                active={repo.id === activeId}
                onUpdated={onUpdated}
                onDisconnected={onDisconnected}
                onAnalyse={() => analyse(repo.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <FolderBrowser open={browserOpen} onOpenChange={setBrowserOpen} onConnected={onConnected} />
    </div>
  );
}

/* -- row -------------------------------------------------------------------- */

function RepoRow({
  repo,
  active,
  onUpdated,
  onDisconnected,
  onAnalyse,
}: {
  repo: RepositorySummary;
  active: boolean;
  onUpdated: (r: RepositorySummary) => void;
  onDisconnected: (id: string) => void;
  onAnalyse: () => void;
}) {
  const [busy, setBusy] = React.useState<"rescan" | "disconnect" | "analyse" | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const isLocal = repo.provider === "local";

  /**
   * Start an analysis and follow it.
   *
   * ⚠️ Does NOT call createRun. The run screen starts a run for the active
   *    project when it mounts, so posting one here too would run the analysis
   *    twice — two rows in the history, two scores, and the SSE stream
   *    attached to whichever finished second.
   *
   * Navigating there is the point: that screen subscribes to the SSE stream, so
   * the user watches the eight stages and the findings arriving rather than
   * staring at a spinner on this page for a minute.
   */
  const analyse = () => {
    setBusy("analyse");
    onAnalyse();
  };

  const rescan = async () => {
    setBusy("rescan");
    try {
      onUpdated(await rescanRepository(repo.id));
    } catch {
      // The row keeps its previous counts. A rescan failing is not worth an
      // error banner across the page.
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    try {
      await disconnectRepository(repo.id);
      onDisconnected(repo.id);
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };

  // A repo with no run has no score, so there is no rating letter to show and
  // no meaningful colour. Rendering 0 or "E" would be inventing a verdict.
  const rating = repo.score === null ? null : ratingFromScore(repo.score);

  return (
    <li className={cn("group relative", active && "bg-hover")}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        {active ? (
          <span className="absolute inset-y-0 left-0 w-[2px] bg-fg" aria-hidden />
        ) : null}

        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-subtle text-2xs font-medium"
          style={rating ? { color: ratingColorVar(rating) } : { color: "var(--text-faint)" }}
          aria-label={rating ? `Rating ${rating}` : "Not analysed yet"}
        >
          {rating ?? "–"}
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm text-fg">
            {isLocal ? (
              <Folder size={11} className="shrink-0 text-fg-faint" aria-hidden />
            ) : (
              <FolderGit2 size={11} className="shrink-0 text-fg-faint" aria-hidden />
            )}
            <span className="truncate">{repo.name}</span>
            {isLocal ? (
              <span className="shrink-0 rounded-sm border border-subtle px-1 text-2xs text-fg-muted">
                local
              </span>
            ) : null}
            {!repo.available ? (
              <span
                className="flex shrink-0 items-center gap-1 text-2xs text-fg-faint"
                title="Connected on a different machine"
              >
                <MonitorOff size={10} aria-hidden />
                other machine
              </span>
            ) : null}
          </p>
          <p
            className="flex items-center gap-1 truncate font-mono text-2xs text-fg-muted"
            title={repo.localPath ?? undefined}
          >
            <GitBranch size={9} aria-hidden />
            {repo.branch}
            {repo.language ? (
              <span className="text-fg-faint"> · {labelForLanguage(repo.language)}</span>
            ) : null}
          </p>
        </div>

        <span className="tnum hidden shrink-0 text-2xs text-fg-faint sm:block">
          {repo.loc === null
            ? "—"
            : `${repo.truncated ? "≥" : ""}${repo.loc.toLocaleString()} lines`}
        </span>

        <span className="tnum w-16 shrink-0 text-right text-2xs text-fg-muted">
          {repo.findings === null ? "not analysed" : `${repo.findings} findings`}
        </span>

        <span
          className="tnum w-8 shrink-0 text-right text-sm font-medium"
          style={{ color: repo.score === null ? "var(--text-faint)" : scoreColorVar(repo.score) }}
          data-metric
        >
          {repo.score ?? "—"}
        </span>

        <span
          className="w-14 shrink-0 text-right text-2xs"
          style={{
            color:
              repo.gate === null
                ? "var(--text-faint)"
                : repo.gate === "passed"
                  ? "var(--sev-success-fg)"
                  : "var(--sev-critical-fg)",
          }}
        >
          {repo.gate === null ? "—" : repo.gate === "passed" ? "✓ gate" : "✕ gate"}
        </span>

        {/* Actions appear on hover/focus so the row stays a row at rest. */}
        <span className="relative z-10 flex w-[168px] shrink-0 items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {repo.available ? (
            <Button
              size="xs"
              variant="quiet"
              onClick={() => void analyse()}
              disabled={busy !== null}
              title="Run the analysis on this folder"
            >
              {busy === "analyse" ? (
                <Loader2 size={12} className="animate-spin" aria-hidden />
              ) : (
                <Play size={12} aria-hidden />
              )}
              Analyse
            </Button>
          ) : null}
          {isLocal && repo.available ? (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => void rescan()}
              disabled={busy !== null}
              aria-label={`Rescan ${repo.name}`}
              title="Refresh the line and file counts"
            >
              {busy === "rescan" ? (
                <Loader2 size={12} className="animate-spin" aria-hidden />
              ) : (
                <RefreshCw size={12} aria-hidden />
              )}
            </Button>
          ) : null}
          <Button
            size="xs"
            variant={confirming ? "danger" : "ghost"}
            onClick={() => (confirming ? void disconnect() : setConfirming(true))}
            onBlur={() => setConfirming(false)}
            disabled={busy !== null}
            aria-label={`Disconnect ${repo.name}`}
            title="Disconnect — the folder on disk is not touched"
          >
            {busy === "disconnect" ? (
              <Loader2 size={12} className="animate-spin" aria-hidden />
            ) : confirming ? (
              "Sure?"
            ) : (
              <Unlink size={12} aria-hidden />
            )}
          </Button>
        </span>
      </div>

      {/* The whole row is a link, behind the action buttons. */}
      <Link
        href={`/reviews?repo=${encodeURIComponent(repo.id)}`}
        className="absolute inset-0 z-0"
        aria-label={`Open ${repo.name}`}
      />
    </li>
  );
}

/* -- empty ------------------------------------------------------------------ */

function EmptyState({ onAddLocal }: { onAddLocal: () => void }) {
  return (
    <div className="mt-1.5 rounded-lg border border-dashed border-strong bg-surface px-6 py-10 text-center">
      <Folder size={20} className="mx-auto text-fg-faint" aria-hidden />
      <p className="mt-2 text-sm text-fg">No projects connected</p>
      <p className="mx-auto mt-1 max-w-[380px] text-2xs text-fg-muted">
        Point CodeMentor at a folder on this machine. Nothing is uploaded — the
        analysis runs where the code already is.
      </p>
      <Button size="sm" variant="primary" className="mt-3" onClick={onAddLocal}>
        <Plus size={13} aria-hidden />
        Connect local folder
      </Button>
    </div>
  );
}

/** Reuses the engine label table's casing conventions for languages. */
function labelForLanguage(language: string): string {
  const named: Record<string, string> = {
    typescript: "TypeScript",
    javascript: "JavaScript",
    python: "Python",
    csharp: "C#",
    cpp: "C++",
    php: "PHP",
    sql: "SQL",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
  };
  return named[language] ?? labelForEngine(language);
}
