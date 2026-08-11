"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { AuroraBackdrop } from "./aurora-backdrop";

/* ============================================================================
   The frame both auth screens sit in.

   ── A SPLIT, NOT A CENTRED CARD ──

   A centred card on a coloured background is the default, and it wastes the
   one moment this product has to say what it is. The left column carries the
   proof — the three things the tool actually does — and the right carries the
   form. On a phone the proof collapses away entirely: someone on a 375px
   screen came to sign in, not to read.

   ── THE ANIMATION BUDGET ──

   One entrance, 400ms, and nothing after. Staggered by 60ms so the eye lands
   on the heading before the fields, which is the reading order anyway.

   No spring, no bounce, no scale — this is a form. Motion here is there to
   establish hierarchy on arrival and then get out of the way. Anything that
   is still moving when the cursor reaches the first field is a bug.
   ========================================================================== */

export function AuthShell({
  children,
  title,
  subtitle,
  footer,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  footer: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-canvas">
      <AuroraBackdrop />

      <div className="relative mx-auto flex min-h-dvh max-w-[1180px] items-center px-5 py-10">
        <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
          {/* ---- proof (hidden on small screens) ------------------------- */}
          <motion.section className="hidden lg:block" {...rise(0)}>
            <Link href="/" className="inline-flex items-center gap-2">
              <ShieldCheck size={18} className="text-fg" aria-hidden />
              <span className="text-md font-semibold tracking-[-0.012em] text-fg">CodeMentor</span>
            </Link>

            <h1 className="mt-8 max-w-[15ch] text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-fg">
              Code review that explains itself.
            </h1>
            <p className="mt-4 max-w-[46ch] text-base leading-[1.65] text-fg-secondary">
              Point it at a folder. Every finding arrives with what is wrong, why it matters, and
              what happens if you ignore it — traced to a real line in your code.
            </p>

            <ul className="mt-9 space-y-4">
              {PROOF.map((p, i) => (
                <motion.li key={p.title} className="flex gap-3" {...rise(0.08 + i * 0.06)}>
                  <span
                    className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: p.color }}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">{p.title}</span>
                    <span className="block text-2xs leading-[1.55] text-fg-muted">{p.body}</span>
                  </span>
                </motion.li>
              ))}
            </ul>
          </motion.section>

          {/* ---- the form ------------------------------------------------- */}
          <motion.section {...rise(0.06)} className="w-full">
            {/* Only on mobile, where the left column is gone and the page
                would otherwise open with no product name at all. */}
            <Link href="/" className="mb-6 inline-flex items-center gap-2 lg:hidden">
              <ShieldCheck size={16} className="text-fg" aria-hidden />
              <span className="text-sm font-semibold tracking-[-0.01em] text-fg">CodeMentor</span>
            </Link>

            <div className="rounded-2xl border border-subtle bg-[var(--bg-surface)]/85 p-6 shadow-[var(--shadow-popover)] backdrop-blur-xl sm:p-7">
              <h2 className="text-lg font-semibold tracking-[-0.014em] text-fg">{title}</h2>
              <p className="mt-1 text-sm leading-[1.55] text-fg-muted">{subtitle}</p>

              <div className="mt-6">{children}</div>
            </div>

            <p className="mt-4 text-center text-2xs text-fg-muted">{footer}</p>
          </motion.section>
        </div>
      </div>
    </div>
  );
}

const PROOF = [
  {
    title: "Nothing leaves your machine",
    body: "Local folders are read in-process. No upload, no clone to a server.",
    color: "var(--sev-success)",
  },
  {
    title: "Every number is measured",
    body: "Scores come from a run you can open. Anything unmeasured says so.",
    color: "var(--sev-medium)",
  },
  {
    title: "It remembers what you repeat",
    body: "The third time you hit the same bug class, it teaches instead of flagging.",
    color: "var(--sev-info, var(--text-secondary))",
  },
];
