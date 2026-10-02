import { WORK_ORDERS, nextWorkOrderId, type WorkOrder } from "../../../data/maintenance";
import { clock } from "../../../state/store";

// Work-order helpers shared by the facility and access skills. Everything
// writes to WORK_ORDERS in src/data/maintenance.ts, which the Maintenance page
// and the unit drawer read, and returns an undo.

export type NewWorkOrder = Omit<WorkOrder, "id" | "opened" | "source" | "log"> & { log?: WorkOrder["log"] };

/** Open a work order (newest first). Returns it and an undo. */
export function createWorkOrder(spec: NewWorkOrder) {
  const now = clock();
  const wo: WorkOrder = {
    ...spec,
    id: nextWorkOrderId(),
    opened: `Today ${now}`,
    source: "Agent",
    log: spec.log ?? [{ at: now, text: "Opened by the Zonera agent for Priya Raman", agent: true }],
  };
  WORK_ORDERS.unshift(wo);
  return {
    wo,
    undo: () => {
      const i = WORK_ORDERS.indexOf(wo);
      if (i >= 0) WORK_ORDERS.splice(i, 1);
    },
  };
}

/** Patch a work order and append log lines. Returns an undo. */
export function updateWorkOrder(wo: WorkOrder, patch: Partial<WorkOrder>, log: string[]) {
  const prev = { ...wo, log: [...wo.log] };
  Object.assign(wo, patch);
  const at = clock();
  wo.log = [...wo.log, ...log.map(text => ({ at: `Today ${at}`, text, agent: true }))];
  return () => {
    Object.assign(wo, prev);
  };
}

/** "13:30" → "1:30 pm" */
export function t12(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}
