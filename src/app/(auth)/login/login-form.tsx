"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MailCheck } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { requestLoginOtp, verifyLoginOtp } from "@/lib/api/auth";
import { resetClientWorkspace } from "@/lib/reset-client-workspace";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, FormError, SubmitButton } from "@/components/auth/auth-form";
import { CodeField } from "@/components/auth/code-field";

/* ============================================================================
   Sign in with a code, in two steps.

   ── THERE IS NO PASSWORD FIELD, AND THAT IS THE FEATURE ──

   The inbox is the credential. Step one takes an address and asks the API to
   mail a six-digit code; step two trades that code for a session. The backend
   still exposes POST /auth/login for non-browser callers, but this screen never
   uses it.

   ── WHAT STEP ONE MUST NOT SAY ──

   ⚠️ The API returns a challenge for EVERY address, whether or not an account
      exists — deliberately, so the sign-in page cannot be used to test which
      addresses are registered. This screen has to preserve that: it never says
      "no account with that email", and the confirmation is phrased "if that
      address has an account". Saying anything sharper would hand back the
      membership oracle the server spends real work closing.

   ── WHY THE STEP LIVES IN STATE AND NOT IN THE URL ──

   A `?step=code` would survive a refresh, and the challenge behind it would
   not: reloading would show a code form bound to a handle the user no longer
   has, and every submission would fail with "not valid" for reasons invisible
   to them. Losing the step on refresh is honest — it puts them back at the one
   action that can rebuild the state.
   ========================================================================== */

const REASONS: Record<string, string> = {
  expired: "Your session expired. Sign in to pick up where you left off.",
  signedout: "You have been signed out.",
  replayed: "That session was used from somewhere else, so everyone was signed out.",
  required: "Sign in to continue.",
  /* Registering does not sign you in — this is the second half of that flow,
     and saying so is what stops it reading as "my new account did not work". */
  registered: "Account created. Enter your email to get a sign-in code.",
};

/**
 * Seconds before "Send again" is offered.
 *
 * A courtesy, not a control — the real limit is the server's five per fifteen
 * minutes, which this cannot see and must not try to mirror. It exists so the
 * button is not a way to burn that allowance in four impatient clicks while the
 * first email is still in flight.
 */
const RESEND_COOLDOWN_SECONDS = 30;

type Step =
  | { name: "email" }
  | { name: "code"; email: string; challengeId: string; expiresInMinutes: number };

export function LoginForm({
  next,
  reason,
  email,
}: {
  next: string | null;
  reason: string | null;
  /** Prefilled after registering, so nobody retypes what they just typed. */
  email: string | null;
}) {
  const router = useRouter();

  const [step, setStep] = React.useState<Step>({ name: "email" });
  const [code, setCode] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice] = React.useState<string | null>(reason ? (REASONS[reason] ?? null) : null);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  /** Step one: ask for a code. Also the "send again" path. */
  async function sendCode(address: string) {
    setPending(true);
    setError(null);

    try {
      const challenge = await requestLoginOtp(address);
      setStep({
        name: "code",
        email: address,
        challengeId: challenge.challengeId,
        expiresInMinutes: challenge.expiresInMinutes,
      });
      setCode("");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setPending(false);
    }
  }

  async function onSubmitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const address = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    await sendCode(address);
  }

  /**
   * Step two.
   *
   * Takes the code as an argument rather than reading state: `onComplete` fires
   * from inside the change handler, where the state update has not landed yet,
   * and reading `code` there would submit the previous five digits.
   */
  async function submitCode(value: string) {
    if (pending || done || step.name !== "code") return;

    setPending(true);
    setError(null);

    try {
      await verifyLoginOtp({ challengeId: step.challengeId, code: value });
      resetClientWorkspace();
      // Held true through the navigation so the button does not flick back to
      // its idle state while the next route is still resolving.
      setDone(true);

      router.replace(safeNext(next));
      // The shell reads the session on the server. Without this the App Router
      // would serve the cached signed-out render of that route.
      router.refresh();
    } catch (err) {
      setPending(false);
      // Clear it. The next attempt starts from an empty field rather than from
      // six wrong digits the user has to select and delete first — and with
      // five attempts on the challenge, making them cheap to retype matters.
      setCode("");
      setError(messageFor(err));
    }
  }

  const footer = (
    <>
      New here?{" "}
      <Link href="/register" className="text-fg underline-offset-2 hover:underline">
        Create an account
      </Link>
    </>
  );

  /* -- step one: the address ---------------------------------------------- */
  if (step.name === "email") {
    return (
      <AuthShell
        title="Sign in"
        subtitle="Your projects, runs and findings are where you left them."
        footer={footer}
      >
        <form onSubmit={onSubmitEmail} className="space-y-4" noValidate>
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
            defaultValue={email ?? undefined}
            autoFocus
            required
            placeholder="you@company.com"
            hint="We'll email you a six-digit code. No password needed."
            disabled={pending}
            aria-describedby={error ? "login-error" : undefined}
          />

          <SubmitButton pending={pending} done={false}>
            {pending ? "Sending code…" : "Email me a code"}
          </SubmitButton>
        </form>
      </AuthShell>
    );
  }

  /* -- step two: the code -------------------------------------------------- */
  return (
    <AuthShell
      title="Check your email"
      subtitle="The code is only good for a few minutes."
      footer={footer}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitCode(code);
        }}
        className="space-y-4"
        noValidate
      >
        {/* Says WHERE it went. Someone who mistyped their address finds out
            here rather than after two minutes of watching an empty inbox. */}
        <div className="flex items-start gap-2 rounded-lg border border-subtle bg-canvas px-3 py-2 text-2xs text-fg-secondary">
          <MailCheck size={13} className="mt-[1px] shrink-0 text-fg-faint" aria-hidden />
          <span className="min-w-0 break-words">
            If <span className="text-fg">{step.email}</span> has an account, a code is on its way.
          </span>
        </div>

        <FormError id="login-error" message={error} />

        <CodeField
          id="code"
          label="Six-digit code"
          value={code}
          onChange={setCode}
          onComplete={(value) => void submitCode(value)}
          disabled={pending || done}
          describedBy={error ? "login-error" : undefined}
        />

        <SubmitButton pending={pending} done={done}>
          {done ? "Signed in" : pending ? "Checking…" : "Sign in"}
        </SubmitButton>

        <div className="flex items-center justify-between pt-1 text-2xs">
          <button
            type="button"
            onClick={() => {
              setStep({ name: "email" });
              setCode("");
              setError(null);
            }}
            disabled={pending || done}
            className="inline-flex items-center gap-1 text-fg-muted underline-offset-2 hover:text-fg-secondary hover:underline disabled:opacity-60"
          >
            <ArrowLeft size={12} aria-hidden />
            Use a different email
          </button>

          <button
            type="button"
            onClick={() => void sendCode(step.email)}
            disabled={pending || done || cooldown > 0}
            className="text-fg-muted underline-offset-2 hover:text-fg-secondary hover:underline disabled:opacity-60 disabled:hover:no-underline"
          >
            {cooldown > 0 ? `Send again in ${cooldown}s` : "Send again"}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

/**
 * What to show the user.
 *
 * `ApiError.message` is the server's own text, which is already written for a
 * human — "That code is not valid. Request a new one.", or the rate limiter's
 * "Try again in 12 minutes." Anything else is the API being unreachable, and
 * saying so beats a generic failure the user cannot act on.
 */
function messageFor(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Could not reach the API. Is the backend running?";
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
