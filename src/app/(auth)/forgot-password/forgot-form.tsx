"use client";

import * as React from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { forgotPassword } from "@/lib/api/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, FormError, SubmitButton } from "@/components/auth/auth-form";

/* ============================================================================
   "I forgot my password."

   ── THE ONE RULE THIS SCREEN MUST NOT BREAK ──

   ⚠️ IT NEVER SAYS WHETHER THE ACCOUNT EXISTS.

      The endpoint behind it needs no credential, so a screen that said "no
      account with that email" would be the cheapest membership oracle in the
      product — type addresses, read the answer, learn who has an account here.
      The API returns 204 for every well-formed address for exactly that reason.

      So the success state below is shown for ANY address, and its wording is
      deliberately conditional: "if that address has an account". It is not
      being coy for its own sake — it is the only honest sentence, because this
      page genuinely does not know.

   The trade is that someone who mistypes their address waits for an email that
   never comes. The "check the address" line in the success state exists for
   them, and it is worth far more than a lookup that leaks the user list.
   ========================================================================== */

export function ForgotPasswordForm() {
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const email = String(new FormData(event.currentTarget).get("email") ?? "");

    setPending(true);
    setError(null);

    try {
      await forgotPassword(email);
      setSent(email);
    } catch (err) {
      setPending(false);
      // Only a malformed address or an unreachable API can land here — an
      // unknown account is a success, by design.
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the API. Is the backend running?"
      );
    }
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="If that address has an account, a reset link is on its way."
        footer={
          <>
            Remembered it?{" "}
            <Link href="/login" className="text-fg underline-offset-2 hover:underline">
              Back to sign in
            </Link>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-subtle bg-canvas px-3 py-3">
            <MailCheck size={15} className="mt-px shrink-0 text-fg-muted" aria-hidden />
            <div className="min-w-0 space-y-1.5">
              <p className="break-words text-sm text-fg">{sent}</p>
              <p className="text-2xs leading-[1.5] text-fg-muted">
                The link is good for 30 minutes and can be used once. Nothing arrived after a
                few minutes? Check the address for a typo and try again — this page cannot tell
                you whether an account exists, on purpose.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSent(null);
              setPending(false);
            }}
            className="text-2xs text-fg-secondary underline-offset-2 hover:text-fg hover:underline"
          >
            Use a different address
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll send a link that lets you choose a new one."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="text-fg underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError id="forgot-error" message={error} />

        <Field
          id="email"
          name="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="you@company.com"
          disabled={pending}
          aria-describedby={error ? "forgot-error" : undefined}
        />

        <SubmitButton pending={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
