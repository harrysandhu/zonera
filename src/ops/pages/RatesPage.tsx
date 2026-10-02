import React from "react";

export default function RatesPage({ id }: { id?: string }) {
  return <div style={{ padding: 32 }} className="muted">rates{id ? " · " + id : ""} — in progress</div>;
}
