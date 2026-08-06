"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { expandCollapse } from "@/lib/motion";

export function SelfCheck({
  question,
}: {
  question: { prompt: string; options: string[]; answerIndex: number; explain: string };
}) {
  const [picked, setPicked] = React.useState<number | null>(null);
  const answered = picked !== null;
  const correct = picked === question.answerIndex;

  return (
    <div className="mt-2 rounded-lg border border-subtle bg-surface p-3">
      <p className="text-base leading-[1.6] text-fg">{question.prompt}</p>

      <ul className="mt-2.5 space-y-1" role="radiogroup" aria-label={question.prompt}>
        {question.options.map((opt, i) => {
          const isAnswer = i === question.answerIndex;
          const isPicked = i === picked;
          // After answering, the right answer is always marked — a quiz that
          // only says "wrong" teaches nothing.
          const show = answered && (isPicked || isAnswer);
          return (
            <li key={i}>
              <button
                role="radio"
                aria-checked={isPicked}
                disabled={answered}
                onClick={() => setPicked(i)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left text-sm",
                  "transition-colors duration-[120ms] disabled:cursor-default",
                  !answered && "border-subtle bg-canvas hover:border-strong hover:bg-hover",
                  answered && !show && "border-subtle bg-canvas opacity-50",
                  show && isAnswer && "border-success-bd bg-success-bg",
                  show && isPicked && !isAnswer && "border-critical-bd bg-critical-bg"
                )}
              >
                <span className="mt-[2px] w-3.5 shrink-0">
                  {show && isAnswer ? (
                    <Check size={13} style={{ color: "var(--sev-success)" }} aria-hidden />
                  ) : show && isPicked ? (
                    <X size={13} style={{ color: "var(--sev-critical)" }} aria-hidden />
                  ) : (
                    <span className="mt-[3px] block h-[9px] w-[9px] rounded-full border border-strong" />
                  )}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 font-mono text-2xs leading-[1.6]",
                    show && isAnswer ? "text-success-fg" : "text-fg-secondary"
                  )}
                >
                  {opt}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <AnimatePresence initial={false}>
        {answered ? (
          <motion.div
            variants={expandCollapse}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="overflow-hidden"
          >
            <div className="mt-2.5 border-t border-subtle pt-2.5" role="status">
              <p className="text-2xs font-medium" style={{ color: correct ? "var(--sev-success)" : "var(--sev-medium)" }}>
                {correct ? "Correct" : "Not quite"}
              </p>
              <p className="prose-explain mt-1">{question.explain}</p>
              <button
                onClick={() => setPicked(null)}
                className="mt-2 text-2xs text-fg-muted underline-offset-2 hover:text-fg hover:underline"
              >
                Try again
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
