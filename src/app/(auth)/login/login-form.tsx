"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { login } from "@/lib/api/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, FormError, PasswordField, SubmitButton } from "@/components/auth/auth-form";

const REASONS: Record<string, string> = {
  expired: "Your session expired. Sign in to pick up where you left off.",
  signedout: "You have been signed out.",
  replayed: "That session was used from somewhere else, so everyone was signed out.",
  required: "Sign in to continue.",
};

export function LoginForm({ next, reason }: { next: string | null; reason: string | null }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice] = React.useState<string | null>(reason ? (REASONS[reason] ?? null) : null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    setPending(true);
    setError(null);

    try {
      await login({ email, password });
      // Held true through the navigation so the button does not flick back to
      // its idle state while the next route is still resolving.
      setDone(true);

      router.replace(safeNext(next));
      // The shell reads the session on the server. Without this the App
      // Router would serve the cached signed-out render of that route.
      router.refresh();
    } catch (err) {
      setPending(false);
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the API. Is the backend running?"
      );
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Your projects, runs and findings are where you left them."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="text-fg underline-offset-2 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {notice && !error ? (
          <div className="rounded-lg border border-subtle bg-canvas px-3 py-2 text-2xs text-fg-secondary">
            {notice}
          </div>
        ) : null}

        <FormError id="login-error" message={error} />

        <Field
          id="email"
          name="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          // The first field on a sign-in page should already be focused —
          // the user came here to type into it.
          autoFocus
          required
          placeholder="you@company.com"
          disabled={pending || done}
          aria-describedby={error ? "login-error" : undefined}
        />

        <PasswordField
          id="password"
          name="password"
          label="Password"
          // `current-password`, not `new-password`. This is what tells a
          // password manager to OFFER a saved credential rather than to
          // generate one.
          autoComplete="current-password"
          required
          placeholder="••••••••••"
          disabled={pending || done}
          aria-describedby={error ? "login-error" : undefined}
        />

        <SubmitButton pending={pending} done={done}>
          {done ? "Signed in" : pending ? "Signing in…" : "Sign in"}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}

/**
 * Where to go after signing in.
 *
 * ⚠️ OPEN REDIRECT GUARD. `next` arrives in the URL, so anyone can craft
 *    `/login?next=https://evil.example`. Accepting it would make this app's own
 *    sign-in page a credible launch point for a phishing hop — the victim sees
 *    the real domain, signs in, and lands somewhere else entirely.
 *
 *    Only a path on this origin is allowed: it must start with a single `/`.
 *    `//evil.example` is protocol-relative and would leave the site, which is
 *    why the second character is checked too.
 */
function safeNext(next: string | null): string {
  if (!next) return "/repositories";
  if (!next.startsWith("/") || next.startsWith("//")) return "/repositories";
  return next;
}
