import React, { useEffect, useState } from "react";
import { Store, LayoutDashboard, Sparkles, Palette, Clapperboard, Headset, EyeOff } from "lucide-react";
import { nav, go, useDemo, routeFromHash, movie, setMovie, setCallsOpen, activity, commit } from "./state/store";
import { FEED } from "./data/tenants";
import { Toasts } from "./ui";
import { OpsShell } from "./ops/OpsShell";
import { Storefront } from "./store/Storefront";
import { BrandPage } from "./brand/BrandPage";

// Seed the activity feed with the morning so far.
if (!activity.length) {
  FEED.slice().reverse().forEach(f => activity.unshift({ id: activity.length + 1000, at: f.t, kind: f.kind, text: f.text, who: f.who }));
}

routeFromHash();

export function App() {
  useDemo();
  const [hideBar, setHideBar] = useState(false);
  const head = nav.route.split("/")[0];

  useEffect(() => {
    // Presenter shortcut: "." hides the demo bar for clean takes.
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === ".") setHideBar(h => !h);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  return (
    <>
      {head === "ops" ? <OpsShell /> : head === "brand" ? <BrandPage /> : <Storefront view={nav.route.split("/")[1] ?? "home"} />}
      <Toasts />
      <nav className={`z-demobar ${hideBar ? "z-demobar--hidden" : ""}`} aria-label="Demo">
        <button aria-pressed={head === "store"} onClick={() => go("store")}>
          <Store /> Storefront
        </button>
        <button aria-pressed={head === "ops" && nav.route !== "ops/agent"} onClick={() => go("ops/overview")}>
          <LayoutDashboard /> Operator
        </button>
        <button aria-pressed={nav.route === "ops/agent"} onClick={() => go("ops/agent")}>
          <Sparkles /> Agent
        </button>
        <button
          aria-pressed={head === "ops" && nav.callsOpen}
          onClick={() => {
            if (head !== "ops") go("ops/overview");
            setCallsOpen(!nav.callsOpen || head !== "ops");
          }}
        >
          <Headset /> Calls
        </button>
        <button aria-pressed={head === "brand"} onClick={() => go("brand")}>
          <Palette /> Brand
        </button>
        <span className="sep" />
        <button aria-pressed={movie.on} onClick={() => setMovie(!movie.on)} title="Scripted flows play themselves">
          <Clapperboard /> Movie mode
        </button>
        <button onClick={() => setHideBar(true)} title="Hide (press . to toggle)" aria-label="Hide demo bar">
          <EyeOff />
        </button>
      </nav>
    </>
  );
}

export { commit };
