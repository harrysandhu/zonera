import React from "react";

export default function DelinquencyPage({ id }: { id?: string }) {
  return <div style={{ padding: 32 }} className="muted">delinquency{id ? " · " + id : ""} — in progress</div>;
}
