import React, { useEffect } from "react";
import { Plus, X, Sparkles, CreditCard, MessageSquare, UserPlus, Users, DoorOpen, KeyRound, AlarmClock, BarChart3 } from "lucide-react";
import { nav, useDemo } from "../state/store";
import { activeSession, agent, closeSession, isHome, setActive, useAgent } from "./engine";
import { launch, newTab } from "./controller";
import { seed } from "./seed";
import { Thread } from "./Thread";
import { Composer } from "./Composer";
import { Rail, statusDot } from "./Rail";
import { Context } from "./Context";
import "../styles/agent.css";

// Agent workspace: session tabs · operations rail · conversation · composer.

const STARTERS = [
  { icon: <UserPlus />, title: "Walk-in move-in", text: "New customer wants a 10×10 today, Jordan Lee" },
  { icon: <CreditCard />, title: "Take a payment", text: "Matthew came in and paid $240 cash" },
  { icon: <Users />, title: "Batch move-ins", text: "Move these three reservations in today: Owen Murphy, Hana Sato, Imani Mensah" },
  { icon: <DoorOpen />, title: "Move-out", text: "Ben Carter is moving out Friday" },
  { icon: <KeyRound />, title: "Vendor gate code", text: "Make a gate code for the HVAC tech, 1–5pm today, Building D only" },
  { icon: <AlarmClock />, title: "Collections", text: "Who's more than 15 days late?" },
  { icon: <MessageSquare />, title: "Text past-due tenants", text: "Text everyone past due a friendly reminder" },
  { icon: <BarChart3 />, title: "Owner report", text: "Generate the September owner report vs last year" },
];

export function AgentWorkspace({ id }: { id?: string }) {
  useDemo();
  useAgent();
  seed();
  if (!agent.sessions.some(s => s.open)) setActive(agent.sessions[0]?.id);
  const s = activeSession();

  // ⌘K / "Ask Zonera" buttons elsewhere hand us a prompt.
  useEffect(() => {
    const p = nav.agentPrompt;
    if (p) {
      nav.agentPrompt = null;
      launch(p.text);
    }
  }, [nav.agentPrompt?.key]);

  if (!s) return null;
  const open = agent.sessions.filter(x => x.open);

  return (
    <div className={`ag ${isHome(s) ? "ag--home" : ""}`}>
      <Rail />
      <section className="ag-main" data-session={s.id}>
        <div className="ag-tabs" role="tablist">
          {open.map(t => (
            <div key={t.id} role="tab" aria-selected={t.id === s.id} className={`ag-tab ${t.id === s.id ? "is-on" : ""}`} onClick={() => setActive(t.id)}>
              {statusDot(t)}
              <span>{t.title}</span>
              <button
                type="button"
                className="ag-tab-x"
                aria-label={`Close ${t.title}`}
                onClick={e => {
                  e.stopPropagation();
                  closeSession(t.id);
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button type="button" className="ag-tab-new" aria-label="New session" onClick={newTab}>
            <Plus size={14} />
          </button>
        </div>

        {isHome(s) ? (
          <div className="ag-home">
            <div className="ag-home-in">
              <span className="ag-home-ic">
                <Sparkles size={18} />
              </span>
              <h1>Good morning, Priya.</h1>
              <p>Tell Zonera what you need. It runs the steps and asks you only when a decision is yours.</p>
              <Composer s={s} variant="home" placeholder="Move someone in, take a payment, text tenants, run a report…" />
              <div className="ag-starters">
                {STARTERS.map(x => (
                  <button key={x.text} type="button" onClick={() => launch(x.text)}>
                    <span className="ag-starter-ic">{x.icon}</span>
                    <b>{x.title}</b>
                    <span>{x.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <Thread s={s} />
            <div className="ag-dock">
              <Composer s={s} variant="dock" />
            </div>
          </>
        )}
      </section>
      {!isHome(s) && <Context s={s} />}
    </div>
  );
}
