"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderGit2 } from "lucide-react";
import { useActiveProject } from "@/lib/active-project";
import { Button } from "@/components/ui/primitives";

/* ============================================================================
   A server-rendered screen reached without `?repo=`.

   Screens that read analysis results are server components, so the aggregation
   happens in one round-trip — but the active project lives in localStorage,
   which the server cannot read. This is the smallest client boundary that
   bridges the two: read the stored id, put it in the URL, and let the server
   render the real thing.

   `replace`, not `push`: the repo-less URL is a redirect step, not a place the
   user chose to be, and leaving it in history would make Back bounce off it.
   ========================================================================== */

export function ResolveActiveProject({
  path,
  title = "No project selected",
  description = "Connect a folder and analyse it — this screen reads that run. Nothing here is sample data.",
}: {
  /** Where to send the user, e.g. "/insights". The repo is appended. */
  path: string;
  title?: string;
  description?: string;
}) {
  const [activeProjectId] = useActiveProject();
  const router = useRouter();
  // Null while the hook's effect is still reading localStorage — the same first
  // render as "nothing stored", so the empty state has to wait a tick before it
  // is allowed to claim there is no project.
  const [settled, setSettled] = React.useState(false);

  React.useEffect(() => {
    if (activeProjectId) {
      router.replace(`${path}?repo=${encodeURIComponent(activeProjectId)}`);
    } else {
      const t = window.setTimeout(() => setSettled(true), 0);
      return () => window.clearTimeout(t);
    }
  }, [activeProjectId, path, router]);

  if (!settled) return null;

  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-[420px] text-center">
        <FolderGit2 size={22} className="mx-auto text-fg-faint" aria-hidden />
        <h1 className="mt-3 text-sm font-medium text-fg">{title}</h1>
        <p className="mt-1 text-2xs text-fg-muted">{description}</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button size="sm" variant="primary" asChild>
            <Link href="/repositories">Connect a folder</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
