"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { resetPassword } from "@/lib/api/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  FormError,
  PasswordField,
  StrengthMeter,
  SubmitButton,
} from "@/components/auth/auth-form";

/* ============================================================================
   Choose a new password, from a reset link.

   ── WHY THIS DOES NOT SIGN THE USER IN ──

   The API returns 204 with no session, and this page sends them to /login
   rather than into the app. That is deliberate: signing in automatically would
   mean a stolen link is a session in ONE step. Making the last step "now type
   the password you just chose" costs a legitimate user four seconds and costs
   someone holding a leaked URL the whole account.

   ── WHY THE CONFIRM FIELD IS CLIENT-SIDE ONLY ──

   The API takes one password and has no opinion about a second. The match check
   here exists because this is the one form in the product where a typo is
   unrecoverable-ish — the old password is already gone by the time you find
   out, and the only way back is another reset link.
   ========================================================================== */

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* ---- no token at all ----------------------------------------------------
     Someone opened /reset-password directly, or a mail client mangled the URL.
     Saying so beats rendering a form whose submit can only ever fail. */
  if (!token) {
    return (
      <AuthShell
        title="That link is incomplete"
        subtitle="The reset link is missing its token, so there is nothing to verify."
        footer={
          <Link href="/login" className="text-fg underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="space-y-4">
          <p className="text-2xs leading-[1.5] text-fg-muted">
            This usually means the link was copied without the whole URL, or an email client
            broke it across two lines. Request a fresh one — links expire after 30 minutes
            anyway.
          </p>
          <Link
            href="/forgot-password"
            className="flex h-10 w-full items-center justify-center rounded-lg bg-fg text-sm font-medium text-fg-inverse hover:opacity-90"
          >
            Request a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  const mismatch = confirm.length > 0 && password !== confirm;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !token) return;

    if (password !== confirm) {
      setError("Those two passwords do not match.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      await resetPassword({ token, newPassword: password });
      setDone(true);
      // A beat on the confirmation, then to sign-in. Long enough to read that
      // every other session was ended, short enough not to feel stuck.
      window.setTimeout(() => router.replace("/login?reason=signedout"), 2200);
    } catch (err) {
      setPending(false);
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the API. Is the backend running?"
      );
    }
  }

  if (done) {
    return (
      <AuthShell
        title="Password changed"
        subtitle="Sign in with your new password."
        footer={
          <Link href="/login" className="text-fg underline-offset-2 hover:underline">
            Go to sign in
          </Link>
        }
      >
        <div className="flex items-start gap-2.5 rounded-lg border border-subtle bg-canvas px-3 py-3">
          <ShieldCheck size={15} className="mt-px shrink-0 text-[var(--sev-success)]" aria-hidden />
          <p className="text-2xs leading-[1.5] text-fg-muted">
            Every other device signed in to this account has been signed out. If you reset
            because you thought someone else had access, they no longer do.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Ten characters or more. Length beats symbols."
      footer={
        <Link href="/login" className="text-fg underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError id="reset-error" message={error} />

        <div>
          <PasswordField
            id="password"
            name="password"
            label="New password"
            // `new-password` so a manager offers to GENERATE and then SAVE one,
            // rather than autofilling the password being replaced.
            autoComplete="new-password"
            autoFocus
            required
            minLength={10}
            placeholder="••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
            aria-describedby={error ? "reset-error" : undefined}
          />
          <StrengthMeter value={password} />
        </div>

        <PasswordField
          id="confirm"
          name="confirm"
          label="Confirm new password"
          autoComplete="new-password"
          required
          placeholder="••••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={pending}
          hint={mismatch ? "These do not match yet." : undefined}
          aria-invalid={mismatch || undefined}
        />

        <SubmitButton pending={pending}>
          {pending ? "Saving…" : "Set new password"}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
