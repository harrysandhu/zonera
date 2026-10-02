import React from "react";
import { nav, setCallsOpen, useDemo } from "../state/store";

// Top-bar pill showing live calls; toggles the push-in panel.
export function CallsPill() {
  useDemo();
  return (
    <button className="z-btn z-btn--sm" onClick={() => setCallsOpen(!nav.callsOpen)}>
      <span className="z-dot z-dot--live" style={{ color: "var(--ok)" }} /> 3 live calls
    </button>
  );
}
