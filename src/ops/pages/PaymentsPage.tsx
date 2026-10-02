import React from "react";

export default function PaymentsPage({ id }: { id?: string }) {
  return <div style={{ padding: 32 }} className="muted">payments{id ? " · " + id : ""} — in progress</div>;
}
