"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ============================================================================
   The six-digit code input.

   ── WHY ONE INPUT AND NOT SIX BOXES ──

   Six separate boxes are the prettier pattern and the worse component. Every
   one of these has to be rebuilt by hand the moment the field is split:

     • paste — the whole point of a code, and it has to be intercepted and
       fanned out across six controlled inputs
     • backspace from an empty box moving focus back a box
     • a screen reader announcing one field instead of six unlabelled ones
     • `autoComplete="one-time-code"`, which browsers fill into a SINGLE input
       and mostly refuse to distribute across a group

   One input gets all of that from the platform for free. What it gives up is
   the segmented look, and that is bought back below with letter-spacing and a
   monospace face rather than with six DOM nodes and a focus manager.

   ── THE THINGS THAT ARE NOT DECORATION ──

   • `inputMode="numeric"` puts a phone on the number pad. Without it people
     type a six-digit code on a QWERTY keyboard.
   • `autoComplete="one-time-code"` is what makes iOS and Safari offer the code
     from the Mail app as a keyboard suggestion.
   • `pattern` + `maxLength` keep a mistyped seventh character from silently
     becoming part of the value.
   ========================================================================== */

export function CodeField({
  id,
  label,
  value,
  onChange,
  onComplete,
  disabled,
  describedBy,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Fired once the sixth digit lands, so the user never hunts for a button. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  const fired = React.useRef(false);

  function handle(next: string) {
    // Strip everything that is not a digit. Codes arrive pasted as "482 915",
    // with the hyphen someone saw in the email, or carrying a non-breaking
    // space from the copy — all of which are the RIGHT code typed by someone
    // who should not have to care.
    const digits = next.replace(/\D/g, "").slice(0, 6);
    onChange(digits);

    // ⚠️ Guarded, not just length-checked. Without the ref this re-fires on
    //    every keystroke once six digits are present — including the ones that
    //    follow a failed attempt — and each one spends a guess against a cap of
    //    five. The guard resets as soon as the value drops below six.
    if (digits.length === 6 && !fired.current) {
      fired.current = true;
      onComplete?.(digits);
    } else if (digits.length < 6) {
      fired.current = false;
    }
  }

  return (
    <div>
      <label htmlFor={id} className="block text-2xs font-medium text-fg-secondary">
        {label}
      </label>
      <input
        id={id}
        name="code"
        value={value}
        onChange={(e) => handle(e.target.value)}
        disabled={disabled}
        autoFocus
        required
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        placeholder="000000"
        aria-describedby={describedBy}
        className={cn(
          "mt-1.5 h-14 w-full rounded-lg border border-subtle bg-canvas text-center",
          "font-mono text-2xl font-semibold text-fg",
          // The indent cancels the trailing letter-space, which would otherwise
          // push the whole string half a character left of true centre.
          "tracking-[0.4em] indent-[0.4em]",
          "placeholder:font-normal placeholder:text-fg-faint",
          "transition-[border-color,box-shadow] duration-[120ms]",
          "hover:border-strong focus:border-focus focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]/25",
          "disabled:opacity-60"
        )}
      />
    </div>
  );
}
