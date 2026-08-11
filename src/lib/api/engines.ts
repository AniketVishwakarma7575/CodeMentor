
/* ============================================================================
   The engine registry.

   Mirrors codementor-backend/src/modules/engines/engines.module.ts.

   `status` is the field that matters: `active` means an adapter exists and ran
   on the last analysis, `planned` means the id is reserved and nothing runs.
   The settings screen must not flatten the two into one green dot — the whole
   reason this endpoint exists is that a reader was being told six analyzers
   had inspected their code when one had.
   ========================================================================== */

/** 1 = READ_ONLY (runs on anything). 2 = INSTALL_AND_EXECUTE (opt-in). */
export type SandboxTier = 1 | 2;

export interface EngineInfo {
  id: string;
  displayName: string;
  status: "active" | "planned";
  ruleCount: number | null;
  tier: SandboxTier | null;
  note: string;
}

