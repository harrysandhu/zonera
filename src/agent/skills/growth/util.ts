// Growth-side records the agent creates. Rate increases approved in agent mode
// wait here until they take effect, keyed by tenant id. Pages that want to
// show "pending increase" can read PENDING_INCREASES (the tenant's ledger and
// messages already carry the notice).

export interface PendingIncrease {
  tenantId: string;
  unitId: string;
  from: number;
  to: number;
  effective: string; // ISO
  noticeSent: string; // ISO
}

export const PENDING_INCREASES = new Map<string, PendingIncrease>();
