import React, { useEffect, useState } from "react";
import { LayoutDashboard, Rocket, Cpu, Inbox, Building2, ShieldCheck, Menu, Search, Sun, Moon, ExternalLink, Sparkles } from "lucide-react";
import { nav, go, useDemo, setTheme } from "../state/store";
import { Mark, Avatar, Button } from "../ui";
import { useFde, fde, openExceptions, runningVms, stage } from "./fde/engine";
import { SimDock } from "./fde/widgets";
import { FLEET } from "./fde/data/portfolio";
import { MissionControl } from "./hq/MissionControl";
import { OnboardingBoard } from "./hq/OnboardingBoard";
import { Workspace } from "./hq/Workspace";
import { VmSession } from "./hq/VmSession";
import { Fleet } from "./hq/Fleet";
import { Queue } from "./hq/Queue";
import { Facilities, FacilityDetail } from "./hq/Facilities";
import { Policies } from "./hq/Policies";
import { AskHq } from "./hq/AskHq";
import "../styles/admin.css";

// Zonera HQ: the super admin. One SDR runs the whole portfolio from here; agents do the
// implementation work, and this screen shows them doing it.

const NAV = [
  { id: "overview", label: "Mission control", icon: LayoutDashboard },
  { id: "onboarding", label: "Onboarding", icon: Rocket },
  { id: "fleet", label: "Agent fleet", icon: Cpu },
  { id: "queue", label: "Needs you", icon: Inbox },
  { id: "facilities", label: "Facilities", icon: Building2 },
  { id: "policies", label: "Policies & vault", icon: ShieldCheck },
] as const;

const TITLES: Record<string, string> = {
  overview: "Mission control",
  onboarding: "Onboarding",
  onboard: "Onboarding",
  vm: "Agent fleet",
  fleet: "Agent fleet",
  queue: "Needs you",
  facilities: "Facilities",
  facility: "Facilities",
  policies: "Policies & vault",
};

export function AdminShell() {
  useDemo();
  useFde();
  const [, page = "overview", id] = nav.route.split("/");
  const [menu, setMenu] = useState(false);
  const [ask, setAsk] = useState(false);
  const active = page === "onboard" ? "onboarding" : page === "vm" ? "fleet" : page === "facility" ? "facilities" : page;
  const needs = openExceptions().filter(e => e === "dup").length + 2;
  const fleetCount = FLEET.length + runningVms().length;
  const dark = nav.theme === "dark" || (!nav.theme && window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  useEffect(() => setMenu(false), [nav.route]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAsk(a => !a);
      }
      if (e.key === "Escape") setAsk(false);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  let body: React.ReactNode;
  if (page === "onboard") body = <Workspace id={id ?? "brennan"} />;
  else if (page === "vm") body = <VmSession id={id ?? "vm-4d90"} />;
  else if (page === "onboarding") body = <OnboardingBoard />;
  else if (page === "fleet") body = <Fleet />;
  else if (page === "queue") body = <Queue />;
  else if (page === "facilities") body = <Facilities />;
  else if (page === "facility") body = <FacilityDetail id={id ?? "F-11042"} />;
  else if (page === "policies") body = <Policies />;
  else body = <MissionControl />;

  const crumb =
    page === "onboard" ? "Brennan Storage Co." : page === "vm" ? id : page === "facility" ? id : null;

  return (
    <div className={`sa ${menu ? "sa--menu" : ""}`} data-page={page}>
      {menu && <div className="sa-scrim" onClick={() => setMenu(false)} />}
      <aside className="sa-side">
        <div className="sa-brand">
          <Mark size={22} />
          <b>Zonera</b>
          <span className="sa-hq">HQ</span>
        </div>
        <nav className="sa-nav" aria-label="HQ">
          <div className="sa-group">
            {NAV.map(n => (
              <button key={n.id} className="sa-link" aria-current={active === n.id ? "page" : undefined} onClick={() => go(`admin/${n.id}`)}>
                <n.icon />
                <span>{n.label}</span>
                {n.id === "queue" && <em className={`sa-badge ${openExceptions().includes("dup") ? "sa-badge--hot" : ""}`}>{needs}</em>}
                {n.id === "fleet" && <em className="sa-badge">{fleetCount}</em>}
                {n.id === "onboarding" && <em className="sa-badge">63</em>}
              </button>
            ))}
          </div>
          <div className="sa-group">
            <div className="sa-group-h">Watching</div>
            <button className="sa-link sa-link--deal" aria-current={page === "onboard" ? "page" : undefined} onClick={() => go("admin/onboard/brennan")}>
              <span className={`sa-live ${fde.run === "running" ? "on" : fde.run === "live" ? "done" : ""}`} />
              <span>Brennan Storage Co.</span>
              <small className="mono">{stage()}</small>
            </button>
          </div>
          <div className="sa-group">
            <div className="sa-group-h">Surfaces</div>
            <button className="sa-link" onClick={() => go("onboard/home")}>
              <ExternalLink />
              <span>Owner portal (as Gail)</span>
            </button>
            <button className="sa-link" onClick={() => go("ops/overview")}>
              <ExternalLink />
              <span>Operator console</span>
            </button>
          </div>
        </nav>
        <div className="sa-foot">
          <div className="sa-me">
            <Avatar name="Jordan Lee" size="sm" />
            <div>
              <b>Jordan Lee</b>
              <small>Growth · the only SDR</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="sa-main">
        <header className="sa-top">
          <Button variant="ghost" size="sm" iconOnly className="sa-burger" aria-label="Menu" onClick={() => setMenu(true)} icon={<Menu />} />
          <div className="sa-title">
            <span className="sa-crumb-root">HQ</span>
            <span className="sa-sep">/</span>
            <span className={crumb ? "sa-crumb-mid" : ""} onClick={() => crumb && go(`admin/${active}`)}>
              {TITLES[page] ?? "Mission control"}
            </span>
            {crumb && (
              <>
                <span className="sa-sep">/</span>
                <span className={page === "vm" || page === "facility" ? "mono" : ""}>{crumb}</span>
              </>
            )}
          </div>
          <button className="sa-search" onClick={() => go("admin/facilities")}>
            <Search size={14} />
            <span>Search 1,042 facilities, operators, VMs…</span>
          </button>
          <button className="sa-askbtn" onClick={() => setAsk(true)}>
            <Sparkles size={14} />
            Ask HQ
            <kbd>⌘K</kbd>
          </button>
          <div className="sa-top-r">
            <Button variant="ghost" size="sm" iconOnly aria-label="Toggle theme" onClick={() => setTheme(dark ? "light" : "dark")} icon={dark ? <Sun /> : <Moon />} />
          </div>
        </header>
        <div className="sa-page">{body}</div>
      </main>
      <AskHq open={ask} onClose={() => setAsk(false)} />
      <SimDock />
    </div>
  );
}
