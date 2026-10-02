import React from "react";

export default function GatePage({ id }: { id?: string }) {
  return <div style={{ padding: 32 }} className="muted">gate{id ? " · " + id : ""} — in progress</div>;
}
