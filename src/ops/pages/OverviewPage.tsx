import React from "react";

export default function OverviewPage({ id }: { id?: string }) {
  return <div style={{ padding: 32 }} className="muted">overview{id ? " · " + id : ""} — in progress</div>;
}
