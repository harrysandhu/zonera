import React from "react";
import { Home } from "./Home";
import { Checkout } from "./Checkout";
import { Access } from "./Access";
import "../styles/store.css";

// Customer storefront. Sub-routes: store (home), store/checkout, store/access.
export function Storefront({ view }: { view: string }) {
  return (
    <div className="st">
      {view === "checkout" ? <Checkout /> : view === "access" ? <Access /> : <Home />}
    </div>
  );
}
