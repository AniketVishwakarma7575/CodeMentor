"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/* ============================================================================
   A cursor-anchored menu.

   Hand-rolled rather than pulling in `@radix-ui/react-context-menu`: this needs
   two items and a position, the project already hand-rolls its command palette,
   and a new runtime dependency for sixty lines is a bad trade.

   The three behaviours that are easy to leave out and immediately noticed:

     • FLIP AT THE EDGE. Right-clicking near the bottom of the sidebar must not
       open a menu half-off the viewport with its items unreachable.
     • CLOSE ON SCROLL, from any ancestor. The menu is pinned to viewport
       coordinates, so the moment the row underneath it moves the menu is
       pointing at something else.
     • KEYBOARD. Arrow keys, Enter, Escape. A context menu reachable only by
       mouse is one the keyboard user watches appear and cannot use.
   ========================================================================== */

export interface MenuItem {
  label: string;
  onSelect: () => void;
  /** Drawn in the critical colour and separated from what sits above it. */
  destructive?: boolean;
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ x, y });
  const [active, setActive] = React.useState(0);

  /* Measured and corrected BEFORE paint — `useLayoutEffect`, not `useEffect`.
     With the latter the menu paints once at the cursor and again at its
     flipped position, which reads as a flicker. */
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const gap = 8;
    setPos({
      x: Math.max(gap, Math.min(x, window.innerWidth - width - gap)),
      y: Math.max(gap, Math.min(y, window.innerHeight - height - gap)),
    });
  }, [x, y]);

  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        items[active]?.onSelect();
      }
    };

    /* All in the CAPTURE phase: the workspace has its own window-level key
       handler (j/k/a/x), and without capture Escape would reach it too. The
       `true` on scroll is what makes an ancestor's scroll close this, not only
       the window's. */
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [active, items, onClose]);

  /* Portalled to `body` so the sidebar's `overflow: hidden` cannot clip it —
     the reason a menu drawn inside a scroll container disappears at its edge. */
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-orientation="vertical"
      style={{ left: pos.x, top: pos.y }}
      className={cn(
        "fixed z-50 min-w-[168px] rounded-md border border-strong bg-elevated py-1",
        "shadow-[var(--shadow-popover)]"
      )}
    >
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {/* A rule above the destructive item, so "Delete" is never the thing
              the pointer lands on by carrying straight down from "Rename…". */}
          {item.destructive && !items[i - 1]?.destructive ? (
            <div className="my-1 h-px bg-[var(--border-subtle)]" role="separator" />
          ) : null}
          <button
            role="menuitem"
            type="button"
            onMouseEnter={() => setActive(i)}
            onClick={() => item.onSelect()}
            className={cn(
              "block w-full px-3 py-1 text-left text-xs",
              item.destructive ? "text-critical-fg" : "text-fg-secondary",
              i === active && (item.destructive ? "bg-critical-bg" : "bg-active text-fg")
            )}
          >
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>,
    document.body
  );
}
