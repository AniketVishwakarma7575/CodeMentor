"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

/* ============================================================================
   Primitives.
   Hand-rolled rather than dropped in from a component library, because the
   default look *is* the tell. Every value below is a token: no arbitrary
   padding, no arbitrary radius, no shadow outside the two floating layers.
   ========================================================================== */

/* -- Button ---------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type ButtonSize = "xs" | "sm" | "md";

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium " +
  "transition-[background-color,border-color,color,opacity] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] " +
  "disabled:pointer-events-none disabled:opacity-40 select-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";

const buttonVariants: Record<ButtonVariant, string> = {
  // The accent in this product is contrast, not hue.
  primary: "bg-fg text-fg-inverse hover:opacity-90 active:opacity-80 border border-transparent",
  secondary: "bg-elevated text-fg border border-strong hover:bg-hover active:bg-active",
  ghost: "bg-transparent text-fg-secondary border border-transparent hover:bg-hover hover:text-fg",
  quiet: "bg-transparent text-fg-muted border border-subtle hover:bg-hover hover:text-fg",
  danger:
    "bg-transparent text-critical-fg border border-critical-bd hover:bg-critical-bg active:bg-critical-bg",
};

const buttonSizes: Record<ButtonSize, string> = {
  xs: "h-6 px-2 text-xs",
  sm: "h-7 px-2.5 text-sm",
  md: "h-8 px-3 text-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "sm", asChild, ...props },
  ref
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    />
  );
});

/** Square icon-only button. Always needs an aria-label. */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { "aria-label": string }
>(function IconButton({ className, variant = "ghost", size = "sm", ...props }, ref) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(size === "xs" ? "w-6 px-0" : size === "sm" ? "w-7 px-0" : "w-8 px-0", className)}
      {...props}
    />
  );
});

/* -- Kbd ------------------------------------------------------------------- */

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-xs border border-subtle",
        "bg-elevated px-1 font-mono text-2xs font-medium text-fg-muted",
        className
      )}
    >
      {children}
    </kbd>
  );
}

/* -- Chip ------------------------------------------------------------------ */
/* radius-sm (4px), not rounded-full. A pill that is a perfect capsule reads as
   consumer software; a 4px chip reads as a label in an engineering tool. */

export function Chip({
  children,
  className,
  active,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-[20px] items-center gap-1 rounded-sm border px-1.5 text-2xs font-medium",
        active
          ? "border-strong bg-active text-fg"
          : "border-subtle bg-surface text-fg-muted",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/* -- Tooltip --------------------------------------------------------------- */

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  children,
  content,
  side = "bottom",
  shortcut,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  shortcut?: string;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 flex items-center gap-2 rounded-md border border-subtle bg-elevated px-2 py-1",
            "text-xs text-fg shadow-[var(--shadow-popover)]",
            "data-[state=delayed-open]:motion-safe:animate-[cm-fade-in_120ms_cubic-bezier(0.16,1,0.3,1)]"
          )}
        >
          {content}
          {shortcut ? <Kbd>{shortcut}</Kbd> : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/* -- Panel ----------------------------------------------------------------- */
/* Elevation is a border plus a surface shift. There is no card shadow in this
   product — a 1px border at low opacity reads as more precise. */

export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-subtle bg-surface", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center justify-between gap-2 border-b border-subtle px-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Section eyebrow. One casing convention across the whole product: Sentence case. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("text-2xs font-medium tracking-[0.04em] text-fg-faint uppercase", className)}>
      {children}
    </span>
  );
}

/* -- Skeleton -------------------------------------------------------------- */
/* Shaped like the content it replaces. A spinner tells the user nothing about
   what is coming; a skeleton tells them the layout before the data lands. */

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        "rounded-sm bg-[linear-gradient(90deg,var(--bg-surface)_0%,var(--bg-hover)_50%,var(--bg-surface)_100%)]",
        "bg-[length:200%_100%] motion-safe:animate-[cm-shimmer_1.6s_linear_infinite]",
        className
      )}
    />
  );
}

/* -- Meter ----------------------------------------------------------------- */

export function MiniBar({
  value,
  max = 100,
  color,
  className,
}: {
  value: number;
  max?: number;
  color: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-xs bg-active", className)}>
      <div className="h-full rounded-xs" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
