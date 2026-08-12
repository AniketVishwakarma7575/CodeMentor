"use client";

import { resetActiveBranches } from "@/lib/active-branch";
import { resetActiveProject } from "@/lib/active-project";
import { resetRepositories } from "@/lib/repositories-store";
import { resetProjectStatus } from "@/lib/use-project-status";

/**
 * Clear browser-local project state that belongs to the signed-in account.
 *
 * The backend scopes repositories by org, but the browser cache is process-
 * local. When a second person signs in on the same browser, keeping this state
 * would show the first person's local folder until the next server round-trip
 * proves it inaccessible.
 */
export function resetClientWorkspace(): void {
  resetActiveProject();
  resetActiveBranches();
  resetRepositories();
  resetProjectStatus();
}
