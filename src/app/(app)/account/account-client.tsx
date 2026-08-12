"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Loader2,
  Monitor,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { ApiError } from "@/lib/api/client";
import {
  changePassword,
  deleteAccount,
  listSessions,
  revokeOtherSessions,
  revokeSession,
  updateProfile,
  type ActiveSession,
} from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-context";
import { Button, Eyebrow } from "@/components/ui/primitives";
import { Field, PasswordField, StrengthMeter } from "@/components/auth/auth-form";
import { cn } from "@/lib/utils";

/* ============================================================================
   The account screen.

   Four sections, ordered by how often someone comes here for them: profile,
   password, devices, and the irreversible one last and visually separated.

   ── EVERY SECTION REPORTS ITS OWN OUTCOME ──

   One page-level toast would be ambiguous the moment two things can be in
   flight — "Saved" under a form nobody submitted is worse than no feedback.
   So each section owns a `Status` line directly beneath its own submit, and
   the server's message is shown verbatim rather than replaced with a generic
   failure: `PATCH /auth/me` explains exactly which rule was broken, and
   throwing that away to say "Something went wrong" is throwing away the answer.
   ========================================================================== */

type Outcome = { kind: "ok" | "error"; message: string } | null;

export function AccountClient({ initialSessions }: { initialSessions: ActiveSession[] | null }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[680px] px-5 py-4">
        <h1 className="text-lg font-semibold tracking-[-0.011em] text-fg">Account</h1>
        <p className="mt-0.5 text-sm text-fg-muted">
          Your details, your password, and every device signed in to this account.
        </p>

        <ProfileSection />
        <PasswordSection />
        <SessionsSection initial={initialSessions} />
        <DangerSection />

        <div className="h-8" />
      </div>
    </div>
  );
}

/* -- profile ----------------------------------------------------------------- */

function ProfileSection() {
  const { user, refresh } = useAuth();
  const [displayName, setDisplayName] = React.useState(user?.displayName ?? "");
  const [email, setEmail] = React.useState(user?.email ?? "");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [outcome, setOutcome] = React.useState<Outcome>(null);

  // The provider is the source of truth — re-sync when it refreshes so this
  // form does not keep showing a stale value after a change elsewhere.
  React.useEffect(() => {
    setDisplayName(user?.displayName ?? "");
    setEmail(user?.email ?? "");
  }, [user?.displayName, user?.email]);

  const emailChanged = user ? email.trim().toLowerCase() !== user.email : false;
  const nameChanged = user ? (displayName.trim() || null) !== (user.displayName ?? null) : false;
  const dirty = emailChanged || nameChanged;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !dirty) return;

    setPending(true);
    setOutcome(null);

    try {
      await updateProfile({
        ...(nameChanged ? { displayName: displayName.trim() || null } : {}),
        // The password only travels when the email is actually changing — the
        // server requires it in that case and rejects it as pointless noise
        // otherwise.
        ...(emailChanged ? { email: email.trim(), password } : {}),
      });
      await refresh();
      setPassword("");
      setOutcome({ kind: "ok", message: "Saved." });
    } catch (err) {
      setOutcome({ kind: "error", message: messageFor(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <Section title="Profile" description="How you appear, and the address you sign in with.">
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <Field
          id="displayName"
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
          placeholder="Your name"
          disabled={pending}
        />

        <Field
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />

        {/* Appears only when it is actually required. A password box sitting
            permanently on a profile form trains people to type it for changes
            that never needed it. */}
        <AnimatePresence initial={false}>
          {emailChanged ? (
            <Collapse>
              <PasswordField
                id="email-password"
                label="Your password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
                hint="The email is your sign-in identity, so changing it needs your password."
              />
            </Collapse>
          ) : null}
        </AnimatePresence>

        <div className="flex items-center gap-2.5 pt-0.5">
          <Button type="submit" variant="primary" size="sm" disabled={pending || !dirty}>
            {pending ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
            Save changes
          </Button>
          <Status outcome={outcome} />
        </div>
      </form>
    </Section>
  );
}

/* -- password ---------------------------------------------------------------- */

function PasswordSection() {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [outcome, setOutcome] = React.useState<Outcome>(null);

  const mismatch = confirm.length > 0 && next !== confirm;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (next !== confirm) {
      setOutcome({ kind: "error", message: "Those two passwords do not match." });
      return;
    }

    setPending(true);
    setOutcome(null);

    try {
      await changePassword({ currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      // The server revoked every session and issued this browser a new one, so
      // the user stays signed in HERE and is signed out everywhere else. Saying
      // so is the point — it is the whole reason to change a password.
      setOutcome({
        kind: "ok",
        message: "Password changed. Every other device has been signed out.",
      });
    } catch (err) {
      setOutcome({ kind: "error", message: messageFor(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <Section
      title="Password"
      description="Changing it signs out every other device, including any you did not recognise."
    >
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <PasswordField
          id="current-password"
          label="Current password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          disabled={pending}
        />

        <div>
          <PasswordField
            id="new-password"
            label="New password"
            autoComplete="new-password"
            required
            minLength={10}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            disabled={pending}
          />
          <StrengthMeter value={next} />
        </div>

        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={pending}
          hint={mismatch ? "These do not match yet." : undefined}
          aria-invalid={mismatch || undefined}
        />

        <div className="flex items-center gap-2.5 pt-0.5">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={pending || !current || next.length < 10}
          >
            {pending ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
            Change password
          </Button>
          <Status outcome={outcome} />
        </div>
      </form>
    </Section>
  );
}

/* -- sessions ---------------------------------------------------------------- */

function SessionsSection({ initial }: { initial: ActiveSession[] | null }) {
  const [sessions, setSessions] = React.useState<ActiveSession[] | null>(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [outcome, setOutcome] = React.useState<Outcome>(null);

  const reload = React.useCallback(async () => {
    try {
      setSessions(await listSessions());
    } catch (err) {
      setOutcome({ kind: "error", message: messageFor(err) });
    }
  }, []);

  async function endOne(id: string) {
    setBusy(id);
    setOutcome(null);
    try {
      await revokeSession(id);
      await reload();
      setOutcome({ kind: "ok", message: "That device has been signed out." });
    } catch (err) {
      setOutcome({ kind: "error", message: messageFor(err) });
    } finally {
      setBusy(null);
    }
  }

  async function endOthers() {
    setBusy("others");
    setOutcome(null);
    try {
      const { revoked } = await revokeOtherSessions();
      await reload();
      setOutcome({
        kind: "ok",
        message:
          revoked === 0
            ? "There were no other sessions to sign out."
            : `Signed out ${revoked} other ${revoked === 1 ? "session" : "sessions"}.`,
      });
    } catch (err) {
      setOutcome({ kind: "error", message: messageFor(err) });
    } finally {
      setBusy(null);
    }
  }

  const others = sessions?.filter((s) => !s.current).length ?? 0;

  return (
    <Section
      title="Signed-in devices"
      description="Every live session on this account. A session lasts 30 days unless it is ended."
    >
      {sessions === null ? (
        <p className="rounded-lg border border-subtle bg-surface px-3 py-3 text-2xs text-fg-muted">
          The API did not respond, so the session list is not shown. It is deliberately not
          filled in from a default — which devices can reach this account is exactly the thing
          this section must not guess about.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-[var(--border-subtle)] rounded-lg border border-subtle bg-surface">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center gap-3 px-3 py-2.5">
                <Monitor size={14} className="shrink-0 text-fg-faint" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">
                    {describeAgent(session.userAgent)}
                    {session.current ? (
                      <span className="ml-1.5 rounded-sm border border-subtle px-1 text-2xs text-fg-muted">
                        this device
                      </span>
                    ) : null}
                  </p>
                  <p className="tnum truncate text-2xs text-fg-muted">
                    Signed in {formatWhen(session.createdAt)} · expires{" "}
                    {formatWhen(session.expiresAt)}
                  </p>
                </div>
                {session.current ? (
                  // No "end" button for the current session — that is what
                  // Sign out is for, and offering both invites someone to lock
                  // themselves out of the page they are standing on.
                  <span className="shrink-0 text-2xs text-fg-faint">active</span>
                ) : (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => endOne(session.id)}
                    disabled={busy !== null}
                  >
                    {busy === session.id ? (
                      <Loader2 size={11} className="animate-spin" aria-hidden />
                    ) : null}
                    End
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-2.5 flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={endOthers}
              disabled={busy !== null || others === 0}
            >
              {busy === "others" ? (
                <Loader2 size={13} className="animate-spin" aria-hidden />
              ) : null}
              Sign out everywhere else
            </Button>
            <Status outcome={outcome} />
          </div>
        </>
      )}
    </Section>
  );
}

/* -- danger ------------------------------------------------------------------ */

function DangerSection() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [outcome, setOutcome] = React.useState<Outcome>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setOutcome(null);

    try {
      await deleteAccount(password);
      // The server cleared the cookies. A hard navigation rather than a router
      // push, so no cached signed-in render of any route survives.
      window.location.href = "/login?reason=signedout";
    } catch (err) {
      setPending(false);
      setOutcome({ kind: "error", message: messageFor(err) });
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-critical-bd bg-critical-bg/40 p-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-critical-fg" aria-hidden />
        <div className="min-w-0 flex-1">
          <Eyebrow className="text-critical-fg">Close this account</Eyebrow>
          <p className="mt-1 text-2xs leading-[1.5] text-fg-secondary">
            Signs you out everywhere and disables sign-in immediately. Your repositories, runs
            and findings are kept rather than deleted — they are what the history is made of,
            and removing them would silently erase every other record that points at them. The
            email cannot be reused for a new account.
          </p>

          {!open ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-critical-fg"
              onClick={() => setOpen(true)}
            >
              <Trash2 size={13} aria-hidden />
              Close account
            </Button>
          ) : (
            <form onSubmit={onSubmit} className="mt-2.5 space-y-2.5" noValidate>
              <PasswordField
                id="delete-password"
                label="Confirm with your password"
                autoComplete="current-password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={pending || password.length === 0}
                >
                  {pending ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
                  Permanently close
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    setPassword("");
                    setOutcome(null);
                  }}
                  disabled={pending}
                >
                  Cancel
                </Button>
              </div>
              <Status outcome={outcome} />
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

/* -- pieces ------------------------------------------------------------------ */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <Eyebrow>{title}</Eyebrow>
      <p className="mb-2 mt-0.5 text-2xs leading-[1.5] text-fg-muted">{description}</p>
      {children}
    </section>
  );
}

/**
 * A section's own result line.
 *
 * `role="status"` for success and `role="alert"` for failure — a screen reader
 * should interrupt for the thing that did not happen and not for the thing
 * that did.
 */
function Status({ outcome }: { outcome: Outcome }) {
  if (!outcome) return null;
  const failed = outcome.kind === "error";

  return (
    <p
      role={failed ? "alert" : "status"}
      className={cn(
        "flex min-w-0 items-start gap-1.5 text-2xs leading-[1.45]",
        failed ? "text-critical-fg" : "text-fg-secondary"
      )}
    >
      {failed ? (
        <AlertTriangle size={11} className="mt-px shrink-0" aria-hidden />
      ) : (
        <Check size={11} className="mt-px shrink-0 text-[var(--sev-success)]" aria-hidden />
      )}
      <span className="min-w-0">{outcome.message}</span>
    </p>
  );
}

function Collapse({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div className="pt-0.5">{children}</div>
    </motion.div>
  );
}

/** The server's wording, whenever there is one. It is written for this reader. */
function messageFor(err: unknown): string {
  return err instanceof ApiError
    ? err.message
    : "Could not reach the API. Is the backend running?";
}

/**
 * A user-agent string, summarised.
 *
 * ⚠️ Never parsed for a decision — it is client-supplied and trivially forged.
 *    This is a recognition aid: the user is trying to answer "is one of these
 *    not me?", and "Chrome on Windows" answers that where 180 characters of
 *    Mozilla/5.0 does not.
 */
function describeAgent(agent: string | null): string {
  if (!agent) return "Unknown device";

  const browser =
    /\bEdg\//.test(agent) ? "Edge"
    : /\bOPR\//.test(agent) ? "Opera"
    : /\bFirefox\//.test(agent) ? "Firefox"
    : /\bChrome\//.test(agent) ? "Chrome"
    : /\bSafari\//.test(agent) ? "Safari"
    : /\bcurl\//i.test(agent) ? "curl"
    : null;

  const platform =
    /\bWindows\b/.test(agent) ? "Windows"
    : /\b(iPhone|iPad)\b/.test(agent) ? "iOS"
    : /\bAndroid\b/.test(agent) ? "Android"
    : /\bMac OS X\b/.test(agent) ? "macOS"
    : /\bLinux\b/.test(agent) ? "Linux"
    : null;

  if (browser && platform) return `${browser} on ${platform}`;
  if (browser) return browser;
  if (platform) return platform;
  // Nothing recognised: show the raw string, trimmed. Better than "Unknown"
  // for a CLI or a script, which is exactly the session worth spotting.
  return agent.length > 48 ? `${agent.slice(0, 48)}…` : agent;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = date.getTime() - Date.now();
  const past = diffMs < 0;
  const minutes = Math.round(Math.abs(diffMs) / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return past ? `${minutes}m ago` : `in ${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return past ? `${hours}h ago` : `in ${hours}h`;

  const days = Math.round(hours / 24);
  if (days < 30) return past ? `${days}d ago` : `in ${days}d`;

  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
