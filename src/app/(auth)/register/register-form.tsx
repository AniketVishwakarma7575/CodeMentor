"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { register } from "@/lib/api/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  Field,
  FormError,
  PasswordField,
  StrengthMeter,
  SubmitButton,
} from "@/components/auth/auth-form";

export function RegisterForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Controlled only so the strength meter can read it. Everything else comes
  // off the FormData on submit — a controlled input per field would re-render
  // the whole form on every keystroke for no benefit.
  const [password, setPassword] = React.useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const displayName = String(form.get("displayName") ?? "").trim();
    const value = String(form.get("password") ?? "");

    // Checked here as well as on the server, so the common mistake costs a
    // keystroke instead of a round-trip. The server rule is the real one.
    if (value.length < 10) {
      setError("Use at least 10 characters. Length matters more than symbols.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      await register({ email, password: value, ...(displayName ? { displayName } : {}) });
      setDone(true);
      router.replace("/repositories");
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
      title="Create an account"
      subtitle="One account, and every project you connect stays on this machine."
      footer={
        <>
          Already have one?{" "}
          <Link href="/login" className="text-fg underline-offset-2 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError id="register-error" message={error} />

        <Field
          id="displayName"
          name="displayName"
          label="Name"
          hint="Optional — used to name your workspace."
          autoComplete="name"
          autoFocus
          maxLength={80}
          placeholder="Aniket Vishwakarma"
          disabled={pending || done}
        />

        <Field
          id="email"
          name="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          disabled={pending || done}
          aria-describedby={error ? "register-error" : undefined}
        />

        <div>
          <PasswordField
            id="password"
            name="password"
            label="Password"
            // `new-password` is what makes a password manager OFFER TO
            // GENERATE and then save one. With `current-password` here it
            // would try to autofill an existing credential instead.
            autoComplete="new-password"
            required
            minLength={10}
            placeholder="At least 10 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending || done}
            aria-describedby={error ? "register-error" : undefined}
          />
          <StrengthMeter value={password} />
        </div>

        <SubmitButton pending={pending} done={done}>
          {done ? "Account created" : pending ? "Creating account…" : "Create account"}
        </SubmitButton>

        <p className="text-2xs leading-[1.5] text-fg-faint">
          Your password is hashed with scrypt before it is stored. Connected folders are read on
          this machine and never uploaded.
        </p>
      </form>
    </AuthShell>
  );
}
