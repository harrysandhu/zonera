import React from "react";

export default function LeadsPage({ id }: { id?: string }) {
  return <div style={{ padding: 32 }} className="muted">leads{id ? " · " + id : ""} — in progress</div>;
}
