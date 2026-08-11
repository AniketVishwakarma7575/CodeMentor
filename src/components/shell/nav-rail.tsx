"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ChevronsLeft,
  FolderGit2,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { USE_FIXTURES } from "@/lib/api/config";
import { useProjectStatus } from "@/lib/use-project-status";
import { cn } from "@/lib/utils";
import { Tooltip, IconButton } from "@/components/ui/primitives";

/* Sentence case everywhere. Mixing "Repositories" with "code review" in one nav
   is one of the loudest tells that a UI was assembled rather than designed. */
const NAV = [
  { href: "/repositories", label: "Repositories", icon: FolderGit2 },
  { href: "/reviews", label: "Reviews", icon: ListChecks },
  { href: "/learning", label: "Learning", icon: BookOpen },
  { href: "/insights", label: "Insights", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * Screens whose content is about ONE project, and which therefore read `?repo=`.
 *
 * Carrying the id in the nav link is what keeps those screens server-rendered:
 * without it they land bare, and a client component has to read localStorage
 * and redirect before anything real can be fetched. `/repositories` is absent
 * deliberately — it is the screen for choosing a project, so scoping it to the
 * current one would be circular.
 */
const REPO_SCOPED = new Set(["/reviews", "/learning", "/insights", "/settings"]);

/**
 * Open findings in the active project's last run.
 *
 * Null — not 0 — when there is no project or no run, because the badge is
 * hidden for null and would read as "all clear" for 0. The fixture pinned this
 * at 8, which stayed 8 on a repo with eleven findings and on one with none.
 */
function useReviewBadge(): { badge: number | null; repoId: string | null } {
  const { run, repo } = useProjectStatus();
  const repoId = repo?.id ?? null;
  if (USE_FIXTURES) return { badge: 8, repoId: null };
  if (!run?.findingCounts) return { badge: null, repoId };
  const total = Object.values(run.findingCounts).reduce((a, b) => a + b, 0);
  return { badge: total > 0 ? total : null, repoId };
}

export function NavRail({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { badge: reviewBadge, repoId } = useReviewBadge();

  return (
    <nav
      aria-label="Primary"
      data-collapsed={collapsed}
      className={cn(
        "flex shrink-0 flex-col border-r border-subtle bg-surface",
        "transition-[width] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        collapsed ? "w-[52px]" : "w-[196px]"
      )}
    >
      <div className={cn("flex h-11 shrink-0 items-center gap-2 border-b border-subtle", collapsed ? "justify-center px-0" : "px-3")}>
        <ShieldCheck size={16} className="shrink-0 text-fg" aria-hidden />
        {!collapsed ? (
          <span className="truncate text-sm font-semibold tracking-[-0.01em] text-fg">CodeMentor</span>
        ) : null}
      </div>

      <ul className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          const badge = href === "/reviews" ? reviewBadge : null;
          const target =
            repoId && REPO_SCOPED.has(href) ? `${href}?repo=${encodeURIComponent(repoId)}` : href;
          const link = (
            <Link
              href={target}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-7 items-center gap-2 rounded-md text-sm",
                "transition-colors duration-[120ms]",
                collapsed ? "justify-center px-0" : "px-2",
                active ? "bg-active text-fg" : "text-fg-secondary hover:bg-hover hover:text-fg"
              )}
            >
              <Icon size={15} className="shrink-0" aria-hidden />
              {!collapsed ? <span className="truncate">{label}</span> : null}
              {!collapsed && badge ? (
                <span className="tnum ml-auto shrink-0 rounded-sm border border-subtle bg-canvas px-1 text-2xs text-fg-muted">
                  {badge}
                </span>
              ) : null}
              {collapsed ? <span className="sr-only">{label}</span> : null}
            </Link>
          );

          return (
            <li key={href}>
              {collapsed ? (
                <Tooltip content={label} side="right">
                  {link}
                </Tooltip>
              ) : (
                link
              )}
            </li>
          );
        })}
      </ul>

      <div className={cn("flex h-9 shrink-0 items-center border-t border-subtle", collapsed ? "justify-center" : "justify-end px-2")}>
        <Tooltip content={collapsed ? "Expand" : "Collapse"} shortcut="[" side="right">
          <IconButton aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} onClick={onToggle} size="xs">
            <ChevronsLeft
              size={14}
              className={cn("transition-transform duration-[180ms]", collapsed && "rotate-180")}
              aria-hidden
            />
          </IconButton>
        </Tooltip>
      </div>
    </nav>
  );
}
