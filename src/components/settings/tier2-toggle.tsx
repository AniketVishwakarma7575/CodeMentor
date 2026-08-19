"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { setRepositoryTier2 } from "@/lib/api/repositories";
import { Button } from "@/components/ui/primitives";

/* ============================================================================
   The tier-2 opt-in — the one control on the settings screen that writes.

   ── WHY IT IS A TWO-STEP CONFIRMATION AND NOT A SWITCH ──

   Turning this on lets the analyser load this project's own
   `eslint.config.js`, which is a JavaScript module EVALUATED inside the API
   process — along with every plugin and parser it imports. A repository the
   user does not fully control is a repository whose config file owns that
   process.

   A toggle is the wrong affordance for that. Toggles are for preferences, they
   are one stray click away from on, and they carry no place to say what the
   click means. So switching it ON requires reading a sentence and pressing a
   button that names the consequence. Switching it OFF is a single click, with
   no confirmation — the safe direction should never be the slower one.

   ── WHY IT RENDERS THE SERVER'S ANSWER, NOT ITS OWN ──

   There is no optimistic update here. `allowTier2` is one of THREE gates; the
   deployment-wide `ESLINT_ENABLED` is independent, cannot be set over HTTP, and
   is very often the one that is actually off. A control that flipped itself to
   "on" would be claiming ESLint now runs, when the honest answer is "this half
   is granted, the other half is still shut". So it renders what came back, and
   the row's own note keeps explaining what is still missing.
   ========================================================================== */

export function Tier2Toggle({
  repoId,
  repoName,
  initial,
}: {
  repoId: string;
  repoName: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function commit(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      // The STORED value, not `next` — see the header.
      const { allowTier2 } = await setRepositoryTier2(repoId, next);
      setAllowed(allowTier2);
      setConfirming(false);
      // The engine registry's row is server-rendered from `GET /engines` and
      // the repository row from `GET /repositories/:id`. Refreshing is what
      // makes the rest of the screen agree with this control instead of going
      // stale until the next navigation.
      startTransition(() => router.refresh());
    } catch (err) {
      // Verbatim: the server's refusals are written for the reader — a
      // non-loopback caller, local folders disabled, an unknown project.
      setError(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setSaving(false);
    }
  }

  if (allowed) {
    return (
      <div className="mt-1.5 rounded-lg border border-subtle bg-surface px-3 py-2.5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: "var(--sev-medium)" }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-fg">Tier 2 is allowed for {repoName}</p>
            <p className="mt-0.5 text-2xs text-fg-muted">
              Analysing this project may run code from it — its ESLint config and the plugins that
              config imports. This does not switch ESLint on by itself:{" "}
              <code className="font-mono">ESLINT_ENABLED</code> must also be set on the server.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => void commit(false)} disabled={saving}>
            {saving ? <Loader2 size={12} className="animate-spin" aria-hidden /> : "Revoke"}
          </Button>
        </div>
        {error ? <p className="mt-2 text-2xs text-[var(--sev-critical-fg)]">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-1.5 rounded-lg border border-subtle bg-surface px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: "var(--text-faint)" }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fg">Tier 2 is off for {repoName}</p>
          <p className="mt-0.5 text-2xs text-fg-muted">
            Engines that need to run the project&rsquo;s own toolchain are skipped. Everything else
            still runs — they only read source.
          </p>
        </div>
        {!confirming ? (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            Allow…
          </Button>
        ) : null}
      </div>

      {confirming ? (
        /*
         * The consequence, in the words it deserves, above a button that
         * repeats it. This is the entire reason the control is not a switch:
         * there has to be somewhere to say this, and a reader has to pass it.
         */
        <div className="mt-2.5 rounded-md border border-[var(--sev-medium)] bg-inset p-3">
          <div className="flex gap-2">
            <AlertTriangle
              size={13}
              className="mt-0.5 shrink-0 text-[var(--sev-medium-fg)]"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-2xs text-fg">
                Allowing tier 2 lets an analysis of <span className="font-mono">{repoName}</span>{" "}
                <strong className="font-medium">execute code from that folder</strong>. ESLint loads{" "}
                <code className="font-mono">eslint.config.js</code>, which is a JavaScript module —
                running it also runs every plugin and parser it imports, with the same access as the
                server process.
              </p>
              <p className="mt-1.5 text-2xs text-fg-muted">
                Only do this for a project you trust and control. You can revoke it at any time.
              </p>
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => void commit(true)} disabled={saving}>
              {saving ? (
                <Loader2 size={12} className="animate-spin" aria-hidden />
              ) : (
                "I trust this folder — allow"
              )}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-2xs text-[var(--sev-critical-fg)]">{error}</p> : null}
    </div>
  );
}
