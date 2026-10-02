// Contract between agent mode / operator pages and the call center.
// The call center sub-system owns the implementation behind these functions;
// callers only depend on these signatures.

import { setCallsOpen, toast } from "../state/store";

export interface OutboundCallRequest {
  name: string;
  phone?: string;
  tenantId?: string;
  /** Why we're calling, in plain words: "finish her 10×10 reservation". */
  purpose: string;
  /** Optional scripted conversation id the call center knows how to play. */
  scriptId?: string;
}

type Impl = {
  startOutboundCall: (req: OutboundCallRequest) => string;
  openCall: (id: string) => void;
};

let impl: Impl = {
  startOutboundCall: req => {
    setCallsOpen(true);
    toast({ title: `Calling ${req.name}`, body: req.purpose, tone: "call" });
    return "call-pending";
  },
  openCall: () => setCallsOpen(true),
};

/** The call center registers its real implementation at module load. */
export function registerCallCenter(i: Impl) {
  impl = i;
}

/** Place an outbound AI voice call. Opens the call panel and returns the call id. */
export function startOutboundCall(req: OutboundCallRequest) {
  return impl.startOutboundCall(req);
}

/** Open the call panel focused on a call. */
export function openCall(id: string) {
  impl.openCall(id);
}
