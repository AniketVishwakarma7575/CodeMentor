import type { Transition, Variants } from "framer-motion";

/* ============================================================================
   CodeMentor AI — motion system
   ----------------------------------------------------------------------------
   Motion in a developer tool is mechanical, not playful. Every animation must
   do one of three jobs:
      (1) show causality — this came from there
      (2) show state change — this became that
      (3) mask latency — something is happening
   Anything else is decoration and gets cut in review.

   Hard rules:
     • Nothing exceeds 400ms.
     • Nothing animates on initial page load except skeleton -> content.
     • Springs are used only where a finger or a cursor is dragging something.
     • Reduced motion removes movement, keeps opacity.
   ========================================================================== */

/** Duration scale, in seconds (Framer's unit). */
export const duration = {
  /** 120ms — hover, press, checkbox, chip toggle. Below perception of "animating". */
  micro: 0.12,
  /** 180ms — an element entering or leaving in place. */
  element: 0.18,
  /** 260ms — layout changes, expand/collapse, list reflow. */
  layout: 0.26,
  /** 400ms — page/route transitions. The ceiling. */
  page: 0.4,
} as const;

/** Entrances decelerate hard: fast start, long settle. Feels instant, lands soft. */
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;
/** Exits are symmetric and unremarkable — the user has already moved on. */
export const easeInOut = [0.4, 0, 0.2, 1] as const;

export const transition = {
  micro: { duration: duration.micro, ease: easeOutExpo },
  element: { duration: duration.element, ease: easeOutExpo },
  layout: { duration: duration.layout, ease: easeOutExpo },
  page: { duration: duration.page, ease: easeOutExpo },
  exit: { duration: duration.micro, ease: easeInOut },
  /** Springs: drag and resize only. Nothing that merely appears. */
  drag: { type: "spring", stiffness: 620, damping: 42, mass: 0.7 },
  resize: { type: "spring", stiffness: 480, damping: 40, mass: 0.8 },
} satisfies Record<string, Transition>;

/* ---------------------------------------------------------------------------
   Reduced motion
   The variants below take a `m` (movement) multiplier from context so a single
   switch strips translation everywhere without touching call sites.
   ------------------------------------------------------------------------- */

export function reducedMotionSafe(shouldReduce: boolean) {
  return {
    /** Movement distance multiplier: 0 when reduced. */
    m: shouldReduce ? 0 : 1,
    /** Skip stagger entirely when reduced — a queue of fades reads as lag. */
    stagger: shouldReduce ? 0 : 0.04,
  };
}

/* ---------------------------------------------------------------------------
   Named variants
   ------------------------------------------------------------------------- */

/** The default entrance. 6px is enough to read as arrival; 20px reads as slow. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: transition.element },
  exit: { opacity: 0, y: -4, transition: transition.exit },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.element },
  exit: { opacity: 0, transition: transition.exit },
};

/**
 * Stagger container. 40ms per child, capped at 8 children — beyond that the
 * last item lands more than a third of a second late and the list feels slow.
 * Pass the child index through `staggerChild` to enforce the cap.
 */
export const staggerList: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0 },
  },
  exit: {},
};

export const STAGGER_CAP = 8;

/** Per-child delay with the cap applied. Item 20 lands with item 8. */
export function staggerDelay(index: number, step = 0.04) {
  return Math.min(index, STAGGER_CAP) * step;
}

/** Findings streaming in during a run: they arrive from the analyzer, so they
 *  enter from the top edge of the list, not from nowhere. */
export const streamIn: Variants = {
  hidden: { opacity: 0, y: -8, scaleY: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scaleY: 1,
    transition: { duration: duration.element, ease: easeOutExpo },
  },
  exit: { opacity: 0, transition: transition.exit },
};

/** Expand/collapse on `height: auto`. Overflow clipping is the caller's job. */
export const expandCollapse: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: { height: transition.exit, opacity: { duration: 0.08 } },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: {
      height: transition.layout,
      opacity: { duration: duration.micro, delay: 0.06 },
    },
  },
};

/** A chip acknowledging a state flip. 1.0 -> 1.04 -> 1.0, no overshoot bounce. */
export const pillPop: Variants = {
  idle: { scale: 1 },
  pop: {
    scale: [1, 1.045, 1],
    transition: { duration: duration.element, ease: easeOutExpo, times: [0, 0.45, 1] },
  },
};

/** Dismissal: the row collapses its own height so the list closes the gap.
 *  The gap closing is the point — it confirms the item is gone. */
export const dismissRow: Variants = {
  visible: { opacity: 1, height: "auto", marginBottom: undefined },
  removed: {
    opacity: 0,
    height: 0,
    marginBottom: 0,
    transition: {
      opacity: { duration: 0.1, ease: easeInOut },
      height: { duration: duration.layout, ease: easeOutExpo, delay: 0.04 },
    },
  },
};

/** Command palette: drops 8px and scales from 0.98. Fast in, faster out. */
export const paletteVariants: Variants = {
  hidden: { opacity: 0, y: -8, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: duration.element, ease: easeOutExpo },
  },
  exit: { opacity: 0, scale: 0.99, transition: { duration: 0.1, ease: easeInOut } },
};

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.micro } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/** Diff reveal: lines uncover top-to-bottom so the eye follows the patch as it
 *  is applied. 22ms per line — fast enough that 40 lines still lands under 1s
 *  of perceived time, and capped so a 300-line patch does not crawl. */
export const diffLine: Variants = {
  hidden: { opacity: 0, x: -4 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: duration.micro, ease: easeOutExpo, delay: Math.min(i, 24) * 0.022 },
  }),
};

/** Pipeline stage: pending -> active -> complete. */
export const stageVariants: Variants = {
  pending: { opacity: 0.45 },
  active: { opacity: 1, transition: transition.element },
  complete: { opacity: 1, transition: transition.element },
  degraded: { opacity: 1, transition: transition.element },
};

/* ---------------------------------------------------------------------------
   countUp — used by the score gauge and every headline metric.
   Not a Framer variant: a rAF loop, because we animate a *number*, and
   re-rendering a motion value into text every frame is cheaper than a spring.
   ------------------------------------------------------------------------- */

export function countUp(
  from: number,
  to: number,
  onFrame: (value: number) => void,
  opts: { duration?: number; reduced?: boolean } = {}
): () => void {
  const ms = (opts.duration ?? duration.page) * 1000;

  if (opts.reduced || ms <= 0) {
    onFrame(to);
    return () => {};
  }

  let raf = 0;
  const start = performance.now();
  // Matches easeOutExpo closely enough for a numeral, and is monotonic.
  const ease = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    onFrame(from + (to - from) * ease(t));
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/** Skeleton shimmer. The only looping animation in the product, and it exists
 *  purely to say "this is loading, not broken". */
export const shimmer: Variants = {
  loading: {
    backgroundPosition: ["200% 0", "-200% 0"],
    transition: { duration: 1.6, ease: "linear", repeat: Infinity },
  },
};

export const shimmerClass =
  "bg-[linear-gradient(90deg,var(--bg-surface)_0%,var(--bg-hover)_50%,var(--bg-surface)_100%)] bg-[length:200%_100%]";

/** Layout-transition preset for shared-element moves (list row -> detail card). */
export const sharedLayout = {
  layout: true as const,
  transition: transition.layout,
};
