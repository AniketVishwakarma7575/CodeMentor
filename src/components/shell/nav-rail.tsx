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
import { cn } from "@/lib/utils";
import { Tooltip, IconButton } from "@/components/ui/primitives";

/* Sentence case everywhere. Mixing "Repositories" with "code review" in one nav
   is one of the loudest tells that a UI was assembled rather than designed. */
const NAV = [
  { href: "/repositories", label: "Repositories", icon: FolderGit2 },
  { href: "/reviews", label: "Reviews", icon: ListChecks, badge: 8 },
  { href: "/learning", label: "Learning", icon: BookOpen },
  { href: "/insights", label: "Insights", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function NavRail({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

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
        {NAV.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname.startsWith(href);
          const link = (
            <Link
              href={href}
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
