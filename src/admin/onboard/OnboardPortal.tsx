import React from "react";
import { nav, go, useDemo } from "../../state/store";
import { Mark, Wordmark, Avatar } from "../../ui";
import { fde, useFde } from "../fde/engine";
import { SimDock, Ring } from "../fde/widgets";
import { pct, stageWords } from "./shared";
import { Signup } from "./Signup";
import { Home } from "./Home";
import { Agreement } from "./Agreement";
import { Billing } from "./Billing";
import { Live } from "./Live";
import "../../styles/admin.css";
import "../../styles/onboard.css";

// The owner's onboarding portal: what Gail Brennan sees from the link Jordan's agents
// emailed her. It renders from the same live FDE simulation as HQ, so every click here
// shows up there.

export function OnboardPortal() {
  useDemo();
  useFde();
  const view = nav.route.split("/")[1] ?? "";

  let body: React.ReactNode;
  if (view === "home") body = <Home />;
  else if (view === "msa") body = <Agreement />;
  else if (view === "billing") body = <Billing />;
  else if (view === "live") body = <Live />;
  else body = <Signup />;

  return (
    <div className="ob" data-view={view || "signup"}>
      <Header />
      <main className="ob-main" key={view || "signup"}>
        {body}
      </main>
      <SimDock />
    </div>
  );
}

function Header() {
  const live = fde.run === "live";
  const started = fde.run !== "idle";
  const p = pct();
  return (
    <header className="ob-top">
      <div className="ob-top-in">
        <button type="button" className="ob-brand" onClick={() => go(started ? "onboard/home" : "onboard")} aria-label="Zonera, your setup">
          <Mark size={24} />
          <Wordmark size={20} />
        </button>
        <span className="ob-top-sep" aria-hidden />
        <span className="ob-org">Brennan Storage Co.</span>

        <div className="ob-top-r">
          {started && (
            <button type="button" className={`ob-status ${live ? "is-live" : ""}`} onClick={() => go(live ? "onboard/live" : "onboard/home")}>
              {live ? (
                <>
                  <i className="ob-status-dot" />
                  <span>Live</span>
                </>
              ) : (
                <>
                  <Ring value={p / 100} size={16} stroke={2.5} />
                  <span className="ob-status-l">Setting up · {stageWords()} · </span>
                  <span className="mono">{p}%</span>
                </>
              )}
            </button>
          )}
          <span className="ob-contact" title="Jordan Lee · jordan@zonera.com">
            <span className="ob-contact-l">Your contact</span>
            <Avatar name="Jordan Lee" size="sm" />
            <b>Jordan Lee</b>
          </span>
        </div>
      </div>
    </header>
  );
}
