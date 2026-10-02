import React from "react";

export default function TenantsPage({ id }: { id?: string }) {
  return <div style={{ padding: 32 }} className="muted">tenants{id ? " · " + id : ""} — in progress</div>;
}
