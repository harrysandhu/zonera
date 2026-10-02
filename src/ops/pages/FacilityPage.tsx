import React from "react";

export default function FacilityPage({ id }: { id?: string }) {
  return <div style={{ padding: 32 }} className="muted">facility{id ? " · " + id : ""} — in progress</div>;
}
