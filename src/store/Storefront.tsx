import React from "react";

// Customer storefront. Sub-routes: store (home), store/checkout, store/access.
export function Storefront({ view }: { view: string }) {
  return <div style={{ padding: 32 }} className="muted">Storefront {view} — in progress</div>;
}
