import React from "react";

export default function LeasesPage({ id }: { id?: string }) {
  return <div style={{ padding: 32 }} className="muted">leases{id ? " · " + id : ""} — in progress</div>;
}
