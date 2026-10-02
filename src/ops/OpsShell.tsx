import React, { useEffect, useState } from "react";
import {
  Sparkles, LayoutDashboard, Map, LayoutGrid, Users, FileSignature, CreditCard, AlarmClock, UserPlus, Tags, KeyRound, Wrench, BarChart3, Headset, Settings,
  Search, Bell, Moon, Sun, ChevronsUpDown, Menu, Command,
} from "lucide-react";
import { nav, go, askAgent, useDemo, setTheme, routeParts } from "../state/store";
import { FACILITY, OTHER_FACILITIES, occupancy } from "../data/facility";
import { OPERATOR, DELINQUENT } from "../data/tenants";
import { Avatar, Mark, Wordmark, Modal } from "../ui";
import { PAGES } from "./pages/registry";
import { CallPanel } from "../calls/CallPanel";
import { CallsPill } from "../calls/CallsPill";
import { HERO } from "../assets";
import "../styles/ops-shell.css";

export interface NavItem { id: string; label: string; icon: React.ReactNode; badge?: () => string | null }

export const NAV: { group: string | null; items: NavItem[] }[] = [
  { group: null, items: [{ id: "agent", label: "Ask Zonera", icon: <Sparkles /> }] },
  {
    group: "Facility",
    items: [
      { id: "overview", label: "Overview", icon: <LayoutDashboard /> },
      { id: "facility", label: "Digital twin", icon: <Map /> },
      { id: "units", label: "Units", icon: <LayoutGrid /> },
      { id: "gate", label: "Gate access", icon: <KeyRound /> },
      { id: "maintenance", label: "Maintenance", icon: <Wrench /> },
    ],
  },
  {
    group: "Customers",
    items: [
      { id: "tenants", label: "Tenants", icon: <Users /> },
      { id: "leases", label: "Leases", icon: <FileSignature /> },
      { id: "leads", label: "Reservations", icon: <UserPlus />, badge: () => "6" },
      { id: "calls", label: "Call center", icon: <Headset /> },
    ],
  },
  {
    group: "Money",
    items: [
      { id: "payments", label: "Payments", icon: <CreditCard /> },
      { id: "delinquency", label: "Delinquency", icon: <AlarmClock />, badge: () => String(DELINQUENT.length) },
      { id: "rates", label: "Rates & promos", icon: <Tags /> },
      { id: "reports", label: "Reports", icon: <BarChart3 /> },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap(g => g.items).concat([{ id: "settings", label: "Settings", icon: <Settings /> }]);

export function OpsShell() {
  useDemo();
  const [, page = "overview", id] = routeParts();
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const [facOpen, setFacOpen] = useState(false);
  const Page = PAGES[page] ?? PAGES.overview;
  const item = ALL_ITEMS.find(i => i.id === page);
  const dark = nav.theme === "dark" || (!nav.theme && window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(p => !p);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  useEffect(() => setMenu(false), [nav.route]);

  return (
    <div className={`os ${nav.callsOpen ? "os--calls" : ""} ${menu ? "os--menu" : ""}`} data-page={page}>
      <aside className="os-side" aria-label="Main">
        <div className="os-brand">
          <Mark size={26} />
          <Wordmark size={23} />
        </div>
        <button className="os-fac" onClick={() => setFacOpen(o => !o)} aria-expanded={facOpen}>
          <span className="os-fac-thumb" aria-hidden style={{ backgroundImage: `url(${HERO.small})` }} />
          <span className="os-fac-txt">
            <b>{FACILITY.short}</b>
            <small>{occupancy().units} units · {(occupancy().byUnit * 100).toFixed(1)}% full</small>
          </span>
          <ChevronsUpDown size={15} />
        </button>
        {facOpen && (
          <div className="os-fac-menu">
            <button className="on" onClick={() => setFacOpen(false)}>
              <b>{FACILITY.name}</b>
              <small>{FACILITY.address}</small>
            </button>
            {OTHER_FACILITIES.map(f => (
              <button key={f.id} onClick={() => setFacOpen(false)}>
                <b>{f.name}</b>
                <small>{f.units} units · {(f.occupancy * 100).toFixed(1)}% full</small>
              </button>
            ))}
          </div>
        )}
        <nav className="os-nav">
          {NAV.map((g, gi) => (
            <div className="os-group" key={gi}>
              {g.group && <div className="os-group-h">{g.group}</div>}
              {g.items.map(it => {
                const b = it.badge?.();
                return (
                  <button key={it.id} className={`os-link ${it.id === "agent" ? "os-link--agent" : ""}`} aria-current={page === it.id ? "page" : undefined} onClick={() => go("ops/" + it.id)}>
                    {it.icon}
                    <span>{it.label}</span>
                    {it.id === "agent" && <span className="z-kbd os-k">⌘K</span>}
                    {b && <em className="os-badge">{b}</em>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="os-foot">
          <button className="os-link" aria-current={page === "settings" ? "page" : undefined} onClick={() => go("ops/settings")}>
            <Settings />
            <span>Settings</span>
          </button>
          <div className="os-me">
            <Avatar name={OPERATOR.name} size="sm" />
            <div>
              <b>{OPERATOR.name}</b>
              <small>{OPERATOR.role}</small>
            </div>
          </div>
        </div>
      </aside>

      <div className="os-main">
        <header className="os-top">
          <button className="z-btn z-btn--ghost z-iconbtn os-burger" aria-label="Menu" onClick={() => setMenu(m => !m)}>
            <Menu />
          </button>
          <div className="os-title">
            {item?.icon}
            <span>{item?.label ?? "Overview"}</span>
            {id && <span className="os-crumb">/ {id}</span>}
          </div>
          <button className="os-ask" onClick={() => setPalette(true)}>
            <Sparkles size={15} />
            <span>Ask Zonera to do anything…</span>
            <span className="z-kbd">⌘K</span>
          </button>
          <div className="os-top-r">
            <CallsPill />
            <button className="z-btn z-btn--ghost z-iconbtn" aria-label="Notifications">
              <Bell />
            </button>
            <button className="z-btn z-btn--ghost z-iconbtn" aria-label="Toggle theme" onClick={() => setTheme(dark ? "light" : "dark")}>
              {dark ? <Sun /> : <Moon />}
            </button>
          </div>
        </header>
        <main className="os-page" id="os-page">
          <Page id={id} />
        </main>
      </div>

      <div className="os-calls" aria-hidden={!nav.callsOpen}>
        <CallPanel />
      </div>
      {menu && <div className="os-menu-scrim" onClick={() => setMenu(false)} />}
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}

const SUGGEST = [
  "What needs my attention today?",
  "Matthew came in and paid $240 cash",
  "Move these three reservations in today: Owen Murphy, Hana Sato, Imani Mensah",
  "Make a gate code for the HVAC tech, 1–5pm today, Building D only",
  "Who's more than 15 days late?",
  "Generate the September owner report",
];

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  useEffect(() => {
    if (open) setQ("");
  }, [open]);
  const submit = (text: string) => {
    if (!text.trim()) return;
    onClose();
    askAgent(text.trim());
  };
  return (
    <Modal open={open} onClose={onClose}>
      <form
        className="os-pal"
        onSubmit={e => {
          e.preventDefault();
          submit(q);
        }}
      >
        <div className="os-pal-in">
          <Sparkles size={18} />
          <input id="os-pal-q" autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Tell Zonera what to do…" />
          <span className="z-kbd">↵</span>
        </div>
        <div className="os-pal-list">
          <div className="eyebrow">Try</div>
          {SUGGEST.map(s => (
            <button type="button" key={s} onClick={() => submit(s)}>
              <Command size={14} />
              {s}
            </button>
          ))}
          <div className="eyebrow" style={{ marginTop: 10 }}>Go to</div>
          <div className="os-pal-go">
            {ALL_ITEMS.slice(1).map(i => (
              <button
                type="button"
                key={i.id}
                onClick={() => {
                  onClose();
                  go("ops/" + i.id);
                }}
              >
                {i.icon}
                {i.label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function SearchIcon() {
  return <Search />;
}
