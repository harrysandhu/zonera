import React from "react";

export default function UnitsPage({ id }: { id?: string }) {
  return <div style={{ padding: 32 }} className="muted">units{id ? " · " + id : ""} — in progress</div>;
}
