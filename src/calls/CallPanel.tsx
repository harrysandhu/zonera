import React from "react";
import { setCallsOpen } from "../state/store";

// Push-in call center panel (right column of the operator shell).
export function CallPanel() {
  return (
    <div style={{ padding: 20 }}>
      <button className="z-btn" onClick={() => setCallsOpen(false)}>Close</button>
      <p className="muted" style={{ marginTop: 12 }}>Call center — in progress</p>
    </div>
  );
}
