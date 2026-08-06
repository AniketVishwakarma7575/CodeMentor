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
  Search,
  Sun,
} from "lucide-react";
import { BRANCHES, REPO } from "@/data/repo";
import { cn, isMac, scoreColorVar } from "@/lib/utils";
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
      <BranchSwitcher />

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
        <RunStatus />
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

/* -- branch switcher -------------------------------------------------------- */

function BranchSwitcher() {
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

/* -- run status ------------------------------------------------------------- */

function RunStatus() {
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

function AccountMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label="Account"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-subtle bg-canvas text-2xs font-medium text-fg-secondary hover:bg-hover"
        >
          AV
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={5}
          className="z-50 w-52 rounded-lg border border-strong bg-elevated p-1 shadow-[var(--shadow-popover)]"
        >
          <div className="border-b border-subtle px-2 py-1.5">
            <p className="truncate text-sm text-fg">Aniket Vishwakarma</p>
            <p className="truncate text-2xs text-fg-muted">acme · Engineering</p>
          </div>
          {["Account settings", "Team & billing", "API tokens", "Sign out"].map((label) => (
            <DropdownMenu.Item
              key={label}
              className="flex h-7 cursor-pointer items-center rounded-md px-2 text-sm text-fg-secondary outline-none data-[highlighted]:bg-hover data-[highlighted]:text-fg"
            >
              {label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
