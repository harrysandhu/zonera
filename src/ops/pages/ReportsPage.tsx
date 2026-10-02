import React from "react";

export default function ReportsPage({ id }: { id?: string }) {
  return <div style={{ padding: 32 }} className="muted">reports{id ? " · " + id : ""} — in progress</div>;
}
