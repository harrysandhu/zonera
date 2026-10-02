import React from "react";

export default function SettingsPage({ id }: { id?: string }) {
  return <div style={{ padding: 32 }} className="muted">settings{id ? " · " + id : ""} — in progress</div>;
}
