"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowRight, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================================
   The credential fields, shared by sign-in and sign-up.

   ── THE ACCESSIBILITY DECISIONS, WHICH ARE NOT OPTIONAL ──

   • `autoComplete` is set precisely: `current-password` on sign-in and
     `new-password` on sign-up. Get this wrong and password managers either
     fail to offer a saved credential or fail to offer to save a new one — the
     single most common reason a beautiful auth screen is worse than a plain
     one.
   • The error is `role="alert"` and tied to the inputs with
     `aria-describedby`, so a screen reader announces it instead of leaving the
     user in a form that silently refused.
   • The reveal toggle is a real button with an accessible name that changes,
     not an icon with a title attribute.
   ========================================================================== */

export interface AuthFieldError {
  message: string;
}

export function Field({
  id,
  label,
  hint,
  ...props
}: {
  id: string;
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-2xs font-medium text-fg-secondary">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className={cn(
          "mt-1.5 h-10 w-full rounded-lg border border-subtle bg-canvas px-3 text-sm text-fg",
          "placeholder:text-fg-faint",
          "transition-[border-color,box-shadow] duration-[120ms]",
          "hover:border-strong focus:border-focus focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]/25",
          "disabled:opacity-60"
        )}
      />
      {hint ? <p className="mt-1 text-2xs text-fg-faint">{hint}</p> : null}
    </div>
  );
}

export function PasswordField({
  id,
  label,
  hint,
  ...props
}: {
  id: string;
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-2xs font-medium text-fg-secondary">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={visible ? "text" : "password"}
          {...props}
          className={cn(
            "h-10 w-full rounded-lg border border-subtle bg-canvas pl-3 pr-10 text-sm text-fg",
            "placeholder:text-fg-faint",
            "transition-[border-color,box-shadow] duration-[120ms]",
            "hover:border-strong focus:border-focus focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]/25",
            "disabled:opacity-60"
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // `tabIndex={-1}` on purpose: Tab should go from the password field
          // to Submit. A reveal toggle in the tab order puts a decoration
          // between the user and the action on every single sign-in.
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md text-fg-faint hover:bg-hover hover:text-fg-secondary"
        >
          {visible ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
        </button>
      </div>
      {hint ? <p className="mt-1 text-2xs text-fg-faint">{hint}</p> : null}
    </div>
  );
}

/**
 * Password strength, shown only while signing UP.
 *
 * Measures LENGTH and variety, and never blocks submission — the backend's
 * only rule is ten characters, and a meter that disagrees with the server is
 * worse than no meter. This is feedback, not a gate.
 */
export function StrengthMeter({ value }: { value: string }) {
  const score = React.useMemo(() => strengthOf(value), [value]);
  if (!value) return null;

  const label = ["Too short", "Weak", "Fair", "Strong"][score];
  const color = ["var(--sev-critical)", "var(--sev-high)", "var(--sev-medium)", "var(--sev-success)"][
    score
  ];

  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-[3px] flex-1 rounded-full transition-colors duration-200"
            style={{ background: i <= score ? color : "var(--bg-active)" }}
          />
        ))}
      </div>
      <p className="mt-1 text-2xs" style={{ color }}>
        {label}
        {score === 0 ? " — 10 characters minimum" : ""}
      </p>
    </div>
  );
}

function strengthOf(value: string): 0 | 1 | 2 | 3 {
  if (value.length < 10) return 0;
  let variety = 0;
  if (/[a-z]/.test(value)) variety++;
  if (/[A-Z]/.test(value)) variety++;
  if (/\d/.test(value)) variety++;
  if (/[^A-Za-z0-9]/.test(value)) variety++;

  // Length carries more weight than character classes, which is the actual
  // maths of guessing cost — a 20-character lowercase passphrase beats
  // `P@ss1!` by orders of magnitude.
  if (value.length >= 20) return 3;
  if (value.length >= 14 && variety >= 2) return 3;
  if (variety >= 2) return 2;
  return 1;
}

/** The submit button, with its own busy state. */
export function SubmitButton({
  children,
  pending,
  done,
}: {
  children: React.ReactNode;
  pending: boolean;
  done?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending || done}
      className={cn(
        "group relative mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-lg",
        "bg-fg text-sm font-medium text-fg-inverse",
        "transition-[opacity,transform] duration-[120ms]",
        "hover:opacity-90 active:scale-[0.995]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/40",
        "disabled:cursor-not-allowed disabled:opacity-70"
      )}
    >
      {pending ? (
        <Loader2 size={14} className="animate-spin" aria-hidden />
      ) : done ? (
        <Check size={14} aria-hidden />
      ) : null}
      {children}
      {!pending && !done ? (
        <ArrowRight
          size={14}
          className="transition-transform duration-[120ms] group-hover:translate-x-0.5"
          aria-hidden
        />
      ) : null}
    </button>
  );
}

/**
 * The failure message.
 *
 * Animated in, because a message that simply appears where nothing was is easy
 * to miss when it sits below the thing you were looking at. Height-collapsed
 * rather than faded, so it does not shift the button under a moving cursor.
 */
export function FormError({ id, message }: { id: string; message: string | null }) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div
          key="err"
          id={id}
          role="alert"
          initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-2 rounded-lg border border-critical-bd bg-critical-bg px-3 py-2 text-2xs text-critical-fg">
            <AlertTriangle size={13} className="mt-[1px] shrink-0" aria-hidden />
            <span className="min-w-0">{message}</span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
