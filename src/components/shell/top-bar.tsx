"use client";

import * as React from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useTheme } from "next-themes";
import {
  Check,
  ChevronDown,
  CircleDot,
  GitBranch,
  Monitor,
  Moon,
  LogOut,
  Search,
  Sun,
  UserCog,
} from "lucide-react";
import { BRANCHES, REPO } from "@/data/repo";
import { useRouter } from "next/navigation";
import { USE_FIXTURES } from "@/lib/api/config";
import { listBranches, type BranchListing } from "@/lib/api/branches";
import { useActiveBranch } from "@/lib/active-branch";
import { useProjectStatus } from "@/lib/use-project-status";
import { useAuth } from "@/lib/auth-context";
import { cn, formatDuration, isMac, pluralize, scoreColorVar } from "@/lib/utils";
import { Button, Kbd, Tooltip } from "@/components/ui/primitives";

export function TopBar({
  onOpenPalette,
  searchRef,
}: {
  onOpenPalette: () => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [mac, setMac] = React.useState(false);
  React.useEffect(() => setMac(isMac()), []);

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-subtle bg-surface px-3">
      {USE_FIXTURES ? <FixtureBranchSwitcher /> : <ProjectSwitcher />}

      <div className="hidden md:block h-4 w-px bg-[var(--border-subtle)]" aria-hidden />

      {/* Search is a real input, not a fake button that opens the palette.
          Typing here filters findings; ⌘K is the jump surface. */}
      <div className="relative flex h-7 min-w-0 flex-1 items-center md:max-w-[420px]">
        <Search size={13} className="pointer-events-none absolute left-2 text-fg-faint" aria-hidden />
        <input
          ref={searchRef}
          type="search"
          placeholder="Search findings, rules, CWE…"
          aria-label="Search findings"
          className={cn(
            "h-7 w-full rounded-md border border-subtle bg-canvas pl-7 pr-10 text-sm text-fg",
            "placeholder:text-fg-faint hover:border-strong focus:border-focus focus:outline-none"
          )}
        />
        <Kbd className="pointer-events-none absolute right-2">/</Kbd>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {USE_FIXTURES ? <FixtureRunStatus /> : <RunStatus />}
        <Button variant="ghost" size="sm" onClick={onOpenPalette} className="hidden lg:inline-flex">
          <Search size={13} aria-hidden />
          <span className="text-fg-muted">Jump to</span>
          <Kbd className="ml-1">{mac ? "⌘K" : "Ctrl K"}</Kbd>
        </Button>
        <ThemeToggle />
        <AccountMenu />
      </div>
    </header>
  );
}

/* -- project switcher ------------------------------------------------------- */

/**
 * The connected project, and a picker for the others.
 *
 * ── WHY THIS IS NOT A BRANCH SWITCHER ──
 *
 * The fixture version lists branches with a score each. A local folder has one
 * branch, read from `.git/HEAD`, and no per-branch analysis exists to score —
 * the backend analyses a directory as it is on disk. So the dropdown switches
 * PROJECTS, which is the choice the user actually has, and the branch is shown
 * as a label rather than offered as an option that cannot be taken.
 *
 * The per-repo line is files and lines, not a score: `RepositorySummary` has no
 * score, and fetching one run per repository to fill a dropdown that is usually
 * never opened would be a request per connected folder on every page load.
 */
function ProjectSwitcher() {
  const [open, setOpen] = React.useState(false);
  const { repo, repos, loading, select } = useProjectStatus();
  const [branch, selectBranch] = useActiveBranch(repo?.id ?? null);
  const [listing, setListing] = React.useState<BranchListing | null>(null);
  const router = useRouter();

  // Branches are fetched only when the popover opens: it is a `git for-each-ref`
  // on the user's machine, and running it on every page load of every screen to
  // fill a menu most navigations never open is work for nothing.
  React.useEffect(() => {
    if (!open || !repo || USE_FIXTURES) return;
    let disposed = false;
    void listBranches(repo.id)
      .then((l) => !disposed && setListing(l))
      .catch(() => !disposed && setListing({ branches: [], available: false, current: null }));
    return () => {
      disposed = true;
    };
  }, [open, repo]);

  // Clear stale branches when the project changes — the list belongs to a repo.
  React.useEffect(() => setListing(null), [repo?.id]);

  const analyseBranch = (next: string | null) => {
    selectBranch(next);
    setOpen(false);
    if (!repo) return;
    const qs = new URLSearchParams({ repo: repo.id });
    if (next) qs.set("branch", next);
    router.push(`/runs?${qs.toString()}`);
  };

  // Nothing to name yet. Rendering a skeleton here would shift the whole header
  // on every navigation for a value that is usually already cached.
  if (loading && !repo) return <div className="h-7 min-w-0 max-w-[360px] flex-shrink" />;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "flex h-7 min-w-0 max-w-[360px] items-center gap-1.5 rounded-md border border-transparent px-2",
            "text-sm text-fg hover:bg-hover focus-visible:border-focus"
          )}
        >
          <GitBranch size={13} className="shrink-0 text-fg-muted" aria-hidden />
          {repo ? (
            <>
              <span className="hidden shrink-0 text-fg-secondary sm:inline">{repo.name}</span>
              <span className="hidden text-fg-faint sm:inline" aria-hidden>
                /
              </span>
              <span className="truncate font-medium">{branch ?? repo.branch}</span>
              {/* The working tree and a branch checkout are different code —
                  the header has to say which one the numbers came from. */}
              {branch ? (
                <span className="hidden shrink-0 rounded-sm border border-subtle px-1 text-2xs text-fg-muted lg:inline">
                  branch
                </span>
              ) : null}
            </>
          ) : (
            <span className="truncate text-fg-muted">Select a project</span>
          )}
          <ChevronDown size={12} className="shrink-0 text-fg-faint" aria-hidden />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={5}
          className="z-50 w-[320px] overflow-hidden rounded-lg border border-strong bg-elevated shadow-[var(--shadow-popover)]"
        >
          {repo ? (
            <div className="border-b border-subtle px-3 py-2">
              <p className="truncate text-sm font-medium text-fg">{repo.name}</p>
              <p className="tnum text-2xs text-fg-muted">
                {repo.files != null && repo.loc != null
                  ? `${repo.files} files · ${repo.loc.toLocaleString()} lines`
                  : "Not scanned yet"}
              </p>
            </div>
          ) : null}

          {repos.length === 0 ? (
            <div className="px-3 py-3">
              <p className="text-2xs text-fg-muted">No projects connected.</p>
              <Link
                href="/repositories"
                onClick={() => setOpen(false)}
                className="mt-1 inline-block text-2xs text-fg underline underline-offset-2"
              >
                Connect a folder
              </Link>
            </div>
          ) : (
            <>
              {/* ---- branches ------------------------------------------------
                  First, because it is the choice the user came here to make.
                  Selecting one navigates straight to a run: picking a branch
                  and then having to find the analyse button is two steps for
                  one intention. */}
              {repo ? (
                <div className="border-b border-subtle">
                  <p className="px-3 pb-1 pt-2 text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
                    Analyse
                  </p>

                  <ul className="max-h-[220px] overflow-y-auto px-1 pb-1">
                    <li>
                      <button
                        onClick={() => analyseBranch(null)}
                        className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
                      >
                        <Check
                          size={13}
                          className={cn("mt-0.5 shrink-0", branch === null ? "text-fg" : "text-transparent")}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-fg">Working tree</span>
                          <span className="block truncate text-2xs text-fg-muted">
                            {listing?.current
                              ? `${listing.current}, including uncommitted changes`
                              : "The folder as it is on disk"}
                          </span>
                        </span>
                      </button>
                    </li>

                    {listing === null ? (
                      <li className="px-2 py-1.5 text-2xs text-fg-faint">Loading branches…</li>
                    ) : !listing.available ? (
                      <li className="px-2 py-1.5 text-2xs text-fg-faint">
                        Not a git repository — only the folder on disk can be analysed.
                      </li>
                    ) : (
                      listing.branches.map((b) => (
                        <li key={b.name}>
                          <button
                            onClick={() => analyseBranch(b.name)}
                            className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
                            title={b.subject || b.name}
                          >
                            <Check
                              size={13}
                              className={cn(
                                "mt-0.5 shrink-0",
                                branch === b.name ? "text-fg" : "text-transparent"
                              )}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-sm text-fg">{b.name}</span>
                                {b.remote ? (
                                  <span className="shrink-0 rounded-sm border border-subtle px-1 text-2xs text-fg-faint">
                                    remote
                                  </span>
                                ) : null}
                              </span>
                              <span className="block truncate text-2xs text-fg-muted">
                                {b.subject || "no commit subject"}
                              </span>
                            </span>
                            <span className="tnum mt-0.5 shrink-0 font-mono text-2xs text-fg-faint">
                              {b.sha.slice(0, 7)}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>

                  {listing?.available ? (
                    <p className="border-t border-subtle px-3 py-1.5 text-2xs leading-[1.45] text-fg-muted">
                      Analysing a branch checks it out in a temporary folder. Your working tree,
                      and anything uncommitted in it, is left alone.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* ---- projects ----------------------------------------------- */}
              <p className="px-3 pb-1 pt-2 text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
                Projects
              </p>
              <ul className="max-h-[200px] overflow-y-auto p-1 pt-0">
                {repos.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => {
                        select(r.id);
                        setOpen(false);
                      }}
                      className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-hover"
                    >
                      <Check
                        size={13}
                        className={cn("shrink-0", r.id === repo?.id ? "text-fg" : "text-transparent")}
                        aria-hidden
                      />
                      <span className="truncate text-sm text-fg">{r.name}</span>
                      <span className="tnum ml-auto shrink-0 text-2xs text-fg-muted">
                        {r.loc != null ? `${r.loc.toLocaleString()} lines` : "—"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* -- run status ------------------------------------------------------------- */

/**
 * The last analysis of the active project.
 *
 * Renders nothing when there is no project or no run. The fixture version is
 * always green with a fixed 62.4s, which reads as "your code is fine" on a
 * screen where nothing has ever been analysed.
 */
function RunStatus() {
  const { repo, run } = useProjectStatus();
  if (!repo) return null;

  if (!run) {
    return (
      <Tooltip content="This project has not been analysed yet" side="bottom">
        <Link
          href={`/runs?repo=${encodeURIComponent(repo.id)}`}
          className="flex h-7 items-center gap-1.5 rounded-md border border-subtle bg-canvas px-2 text-xs text-fg-muted hover:bg-hover"
        >
          <CircleDot size={12} className="text-fg-faint" aria-hidden />
          <span className="hidden sm:inline">Never analysed</span>
        </Link>
      </Tooltip>
    );
  }

  const total = Object.values(run.findingCounts ?? {}).reduce((a, b) => a + b, 0);
  const { label, color } = RUN_STATUS[run.status] ?? RUN_STATUS.complete;

  return (
    <Tooltip
      content={`${label} · ${pluralize(total, "finding")}${
        run.score != null ? ` · score ${run.score}` : ""
      }`}
      side="bottom"
    >
      <Link
        href={`/runs?repo=${encodeURIComponent(repo.id)}`}
        className="flex h-7 items-center gap-1.5 rounded-md border border-subtle bg-canvas px-2 text-xs text-fg-secondary hover:bg-hover"
      >
        <CircleDot size={12} style={{ color }} aria-hidden />
        <span className="hidden sm:inline">{label}</span>
        {run.durationMs != null ? (
          <span className="tnum text-fg-faint">{formatDuration(run.durationMs)}</span>
        ) : null}
      </Link>
    </Tooltip>
  );
}

const RUN_STATUS: Record<string, { label: string; color: string }> = {
  complete: { label: "Run complete", color: "var(--sev-success)" },
  running: { label: "Running", color: "var(--sev-medium)" },
  queued: { label: "Queued", color: "var(--text-faint)" },
  failed: { label: "Run failed", color: "var(--sev-critical)" },
  cancelled: { label: "Cancelled", color: "var(--text-faint)" },
};

/* -- design mode ------------------------------------------------------------ */

function FixtureBranchSwitcher() {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "flex h-7 min-w-0 max-w-[360px] items-center gap-1.5 rounded-md border border-transparent px-2",
            "text-sm text-fg hover:bg-hover focus-visible:border-focus"
          )}
        >
          <GitBranch size={13} className="shrink-0 text-fg-muted" aria-hidden />
          <span className="hidden shrink-0 text-fg-secondary sm:inline">{REPO.name}</span>
          <span className="hidden text-fg-faint sm:inline" aria-hidden>
            /
          </span>
          <span className="truncate font-medium">{REPO.branch}</span>
          <span className="tnum hidden shrink-0 rounded-sm border border-subtle px-1 text-2xs text-fg-muted lg:inline">
            #{REPO.pr}
          </span>
          <ChevronDown size={12} className="shrink-0 text-fg-faint" aria-hidden />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={5}
          className="z-50 w-[320px] overflow-hidden rounded-lg border border-strong bg-elevated shadow-[var(--shadow-popover)]"
        >
          <div className="border-b border-subtle px-3 py-2">
            <p className="truncate text-sm font-medium text-fg">{REPO.name}</p>
            <p className="tnum text-2xs text-fg-muted">
              {REPO.files} files · {REPO.loc.toLocaleString()} lines · last run {REPO.lastRun}
            </p>
          </div>
          <ul className="p-1">
            {BRANCHES.map((b) => (
              <li key={b.name}>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-hover"
                >
                  <Check
                    size={13}
                    className={cn("shrink-0", b.active ? "text-fg" : "text-transparent")}
                    aria-hidden
                  />
                  <span className="truncate text-sm text-fg">{b.name}</span>
                  <span
                    className="tnum ml-auto shrink-0 text-xs font-medium"
                    style={{ color: scoreColorVar(b.score) }}
                  >
                    {b.score}
                  </span>
                  {b.delta !== 0 ? (
                    <span className="tnum w-8 shrink-0 text-right text-2xs text-fg-muted">
                      {b.delta > 0 ? "+" : "−"}
                      {Math.abs(b.delta)}
                    </span>
                  ) : (
                    <span className="w-8 shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function FixtureRunStatus() {
  return (
    <Tooltip content="Analysis finished 2 minutes ago · 8 findings" side="bottom">
      <Link
        href="/runs"
        className="flex h-7 items-center gap-1.5 rounded-md border border-subtle bg-canvas px-2 text-xs text-fg-secondary hover:bg-hover"
      >
        <CircleDot size={12} style={{ color: "var(--sev-success)" }} aria-hidden />
        <span className="hidden sm:inline">Run complete</span>
        <span className="tnum text-fg-faint">62.4s</span>
      </Link>
    </Tooltip>
  );
}

/* -- theme ------------------------------------------------------------------ */

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  // Only the *label* needs mount-awareness; the class is already correct,
  // applied by the pre-paint script. No flash, no layout shift.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const Icon = !mounted ? Monitor : resolvedTheme === "light" ? Sun : Moon;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label="Theme"
          className="flex h-7 w-7 items-center justify-center rounded-md text-fg-secondary hover:bg-hover hover:text-fg"
        >
          <Icon size={14} aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={5}
          className="z-50 w-40 rounded-lg border border-strong bg-elevated p-1 shadow-[var(--shadow-popover)]"
        >
          {(
            [
              ["dark", "Dark", Moon],
              ["light", "Light", Sun],
              ["system", "System", Monitor],
            ] as const
          ).map(([value, label, I]) => (
            <DropdownMenu.Item
              key={value}
              onSelect={() => setTheme(value)}
              className="flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-fg-secondary outline-none data-[highlighted]:bg-hover data-[highlighted]:text-fg"
            >
              <I size={13} aria-hidden />
              {label}
              {mounted && theme === value ? <Check size={13} className="ml-auto" aria-hidden /> : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* -- account ---------------------------------------------------------------- */

/**
 * The signed-in user, and what they can do about it.
 *
 * The fixture version listed "Account settings", "Team & billing" and "API
 * tokens" — three items that did nothing, next to a Sign out that also did
 * nothing. The rule that replaced it stands: only real actions appear here,
 * because a menu of dead links is worse than a short menu — the user finds out
 * one click at a time.
 *
 * "Account" is here now because the page behind it exists and does something:
 * profile, password, and the list of devices signed in to this account. "Team
 * & billing" and "API tokens" are still absent, for the original reason.
 */
function AccountMenu() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = React.useState(false);

  const label = user?.displayName || user?.email || "Account";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={user ? `Account — ${label}` : "Account"}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-subtle bg-canvas text-2xs font-medium text-fg-secondary hover:bg-hover"
        >
          {initialsOf(label)}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={5}
          className="z-50 w-56 rounded-lg border border-strong bg-elevated p-1 shadow-[var(--shadow-popover)]"
        >
          {user ? (
            <div className="border-b border-subtle px-2 py-1.5">
              <p className="truncate text-sm text-fg">{user.displayName || user.email}</p>
              <p className="truncate text-2xs text-fg-muted">
                {user.orgName}
                {user.displayName ? ` · ${user.email}` : ""}
              </p>
            </div>
          ) : null}

          <DropdownMenu.Item asChild>
            <Link
              href="/account"
              className="flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-fg-secondary outline-none data-[highlighted]:bg-hover data-[highlighted]:text-fg"
            >
              <UserCog size={13} aria-hidden />
              Account
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            disabled={signingOut}
            onSelect={(event) => {
              // Radix closes the menu on select, which unmounts this item
              // mid-await. Preventing the default keeps it alive long enough
              // to show "Signing out…" instead of vanishing.
              event.preventDefault();
              setSigningOut(true);
              void signOut();
            }}
            className="flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-fg-secondary outline-none data-[highlighted]:bg-hover data-[highlighted]:text-fg data-[disabled]:opacity-60"
          >
            <LogOut size={13} aria-hidden />
            {signingOut ? "Signing out…" : "Sign out"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** "Aniket Vishwakarma" → AV. An email falls back to its first two letters. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? "?").slice(0, 2).toUpperCase();
}
