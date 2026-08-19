"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { TooltipProvider } from "@/components/ui/primitives";
import { NavRail } from "./nav-rail";
import { TopBar } from "./top-bar";
import { CommandPalette } from "./command-palette";
import { ShortcutSheet } from "./shortcut-sheet";
import { isTypingTarget } from "@/lib/shortcuts";

/**
 * Global keyboard scope.
 *
 * Only bindings that are meaningful everywhere live here. Findings-scoped keys
 * (j/k/a/e/x) belong to the review screen so they cannot fire on a page where
 * there is nothing to apply a fix to.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const { theme, setTheme } = useTheme();

  // Rail state survives reloads — a preference this strong should not reset.
  React.useEffect(() => {
    const stored = localStorage.getItem("cm-rail-collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);
  React.useEffect(() => {
    localStorage.setItem("cm-rail-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setTheme(theme === "light" ? "dark" : "light");
        return;
      }
      if (mod) return;

      // Never steal a keystroke from a text field.
      if (isTypingTarget(e.target)) return;

      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      } else if (e.key === "[") {
        e.preventDefault();
        setCollapsed((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTheme, theme]);

  return (
    <TooltipProvider delayDuration={280} skipDelayDuration={200}>
      {/* ⚠️ `fixed inset-0`, NOT `h-dvh`. This is desktop software: panes
          scroll, the page does not — and `h-dvh` was not actually enforcing
          that.

          `h-dvh` makes the shell exactly one viewport tall, but it leaves it
          IN FLOW, so it still contributes to the document's height. Anything
          that adds even a few pixels below or beside it — a horizontal
          scrollbar on the document, a stray margin, a portalled overlay —
          makes the document taller than the viewport and therefore
          scrollable. Once it is scrollable at all, a wheel gesture that
          reaches the end of an inner pane CHAINS to the document and drags
          the whole shell up, leaving a band of blank canvas below it. That is
          the empty white area under the review workspace.

          `fixed inset-0` takes the shell out of flow entirely. It is pinned to
          the viewport and can no longer contribute any document height, so the
          page has nothing to scroll regardless of what else is on it. Paired
          with `overscroll-behavior: none` on the document (globals.css), which
          stops the chaining itself. */}
      {/* Visually hidden until focused. Without it a keyboard user tabs the
          whole rail and top bar before reaching the findings. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:border focus:border-strong focus:bg-elevated focus:px-3 focus:py-1.5 focus:text-sm focus:text-fg"
      >
        Skip to content
      </a>

      <div className="fixed inset-0 flex w-full overflow-hidden bg-canvas">
        <div className="hidden sm:flex">
          <NavRail collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenPalette={() => setPaletteOpen(true)} searchRef={searchRef} />
          <main id="main" className="min-h-0 flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutSheet open={helpOpen} onOpenChange={setHelpOpen} />
    </TooltipProvider>
  );
}
