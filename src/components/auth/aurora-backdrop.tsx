"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";

/* ============================================================================
   The auth screen's backdrop.

   ── WHY THIS IS CANVAS AND NOT A VIDEO ──

   A looping mp4 is the usual way to do this and it is the wrong trade here:

     • WEIGHT. A background loop that does not visibly band is 3–8 MB. That is
       ten times the entire JavaScript bundle of this app, downloaded before
       someone can type a password.
     • IT IS A SIGN-IN PAGE. The person looking at it wants to be past it. A
       screen whose first job is to stream video makes the fastest possible
       path — type, tab, enter — wait on the slowest possible asset.
     • THEME. A video is baked at one brightness. This reads the same tokens as
       the rest of the product, so it is correct in light and dark without
       shipping two files.

   What is here instead: drifting colour fields composited with `lighter`, at
   ~45 KB of code, resolution-independent, and themed. If you would rather have
   footage, drop a `<video>` behind this component and delete it — the layout
   does not care which one paints.

   ── THE MOTION BUDGET ──

   Slow. Every blob takes 30–60 seconds to cross the frame, because this sits
   behind a form: motion in peripheral vision that competes with a text cursor
   is the difference between "premium" and "hard to use".

   `prefers-reduced-motion` stops the loop entirely and paints one static
   frame. Not a slower animation — for a vestibular trigger, slower is still a
   trigger.
   ========================================================================== */

interface Blob {
  x: number;
  y: number;
  /** Velocity in fractions of the canvas per second. */
  vx: number;
  vy: number;
  radius: number;
  hue: number;
}

/** Deep indigo → violet → cyan. Sampled to sit under white text at any point. */
const HUES = [232, 258, 280, 199];

export function AuroraBackdrop() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let last = performance.now();

    const blobs: Blob[] = HUES.map((hue, i) => ({
      x: 0.2 + (i % 2) * 0.6,
      y: 0.25 + Math.floor(i / 2) * 0.5,
      // Deliberately irrational-ish ratios so the four never resynchronise into
      // a visible pulse.
      vx: (i % 2 === 0 ? 1 : -1) * (0.012 + i * 0.004),
      vy: (i < 2 ? 1 : -1) * (0.009 + i * 0.003),
      radius: 0.38 + i * 0.06,
      hue,
    }));

    /**
     * Cap the backing store at 2× CSS pixels.
     *
     * A 3× phone or a 5K display would otherwise allocate a canvas several
     * times larger than anything the blur can resolve — pure cost, since every
     * shape here is a soft gradient with no edge to sharpen.
     */
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function paint(dt: number) {
      ctx!.clearRect(0, 0, width, height);

      // `lighter` — the blobs ADD where they overlap, which is how light
      // behaves and why the intersections read as a third colour rather than
      // as one shape sitting on top of another.
      ctx!.globalCompositeOperation = "lighter";

      const scale = Math.max(width, height);

      for (const b of blobs) {
        if (dt > 0) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          // Reflect rather than wrap: a blob reappearing on the opposite edge
          // is a visible jump, and this is a slow, continuous field.
          if (b.x < -0.2 || b.x > 1.2) b.vx *= -1;
          if (b.y < -0.2 || b.y > 1.2) b.vy *= -1;
        }

        const cx = b.x * width;
        const cy = b.y * height;
        const r = b.radius * scale;

        const gradient = ctx!.createRadialGradient(cx, cy, 0, cx, cy, r);
        gradient.addColorStop(0, `hsl(${b.hue} 85% 58% / 0.34)`);
        gradient.addColorStop(0.45, `hsl(${b.hue} 80% 48% / 0.14)`);
        gradient.addColorStop(1, `hsl(${b.hue} 75% 40% / 0)`);

        ctx!.fillStyle = gradient;
        ctx!.beginPath();
        ctx!.arc(cx, cy, r, 0, Math.PI * 2);
        ctx!.fill();
      }

      ctx!.globalCompositeOperation = "source-over";
    }

    function loop(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05); // clamp after a tab switch
      last = now;
      paint(dt);
      frame = requestAnimationFrame(loop);
    }

    resize();

    if (reduce) {
      // One frame, no loop. Still composed, still coloured — just still.
      paint(0);
    } else {
      frame = requestAnimationFrame(loop);
    }

    const observer = new ResizeObserver(() => {
      resize();
      paint(0);
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [reduce]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <canvas ref={canvasRef} className="h-full w-full" />

      {/* Grain. Four percent of a tiled SVG noise, which is what stops the
          gradients from banding on an 8-bit display — the artefact that makes
          a smooth backdrop look cheap. */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Vignette, so the form's edge always has contrast to sit against no
          matter where the blobs have drifted. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,var(--bg-canvas)_100%)]" />
    </div>
  );
}
