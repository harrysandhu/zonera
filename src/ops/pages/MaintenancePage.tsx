import React from "react";

export default function MaintenancePage({ id }: { id?: string }) {
  return <div style={{ padding: 32 }} className="muted">maintenance{id ? " · " + id : ""} — in progress</div>;
}
