
/* ============================================================================
   The engine registry.

   Mirrors codementor-backend/src/modules/engines/engines.module.ts.

   `status` is the field that matters, and it has three values:

     active      an adapter exists and runs on every analysis
     configured  implemented, but waiting on a credential — it did NOT run
     planned     the id is reserved and no code exists

   The settings screen must not flatten these into one green dot. The whole
   reason this endpoint exists is that a reader was being told six analyzers
   had inspected their code when one had — and `configured` exists because the
   registry then made the opposite mistake, reporting the AI review engine as
   unbuilt while it was producing findings.

   `configured` is the only state the reader can act on: it means "set the key".
   ========================================================================== */

/** 1 = READ_ONLY (runs on anything). 2 = INSTALL_AND_EXECUTE (opt-in). */
export type SandboxTier = 1 | 2;

export interface EngineInfo {
  id: string;
  displayName: string;
  status: "active" | "configured" | "planned";
  ruleCount: number | null;
  tier: SandboxTier | null;
  note: string;
}

