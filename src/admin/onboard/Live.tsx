import React from "react";
import { Check, ArrowRight, KeyRound, CreditCard, Receipt, Building2, Play } from "lucide-react";
import { go } from "../../state/store";
import { Button, Pill } from "../../ui";
import { fde, useFde, elapsed, ownerProgress, startFde } from "../fde/engine";
import { Ring } from "../fde/widgets";
import { N } from "../fde/data/vms";
import { OWNER_ITEMS, DEAL } from "../fde/data/deal";
import { pct, stageWords, WORK_GROUPS, groupWork, TASK_WORDS, Spinner } from "./shared";

// You're live: what moved, what was verified, and what changes for tenants (nothing).

export function Live() {
  useFde();
  if (fde.run !== "live") return <NotYet />;

  const stats = [
    { l: "Tenants", v: N.tenants, f: "Match Keystone" },
    { l: "Units", v: N.units, f: "Match Keystone" },
    { l: "Ledger lines", v: N.ledger, f: "To the cent" },
    { l: "Documents", v: N.docs, f: "All accounted for" },
    { l: "Autopay cards", v: N.autopay, f: "$0 test passed" },
    { l: "Gate codes", v: N.tenants, f: "Read back from PDK" },
  ];

  return (
    <div className="ob-page">
      <header className="ob-live-h">
        <span className="ob-check ob-check--lg">
          <Check size={18} strokeWidth={2.6} />
        </span>
        <p className="ob-eyebrow">Fri Oct 2 · 5:45 am</p>
        <h1 className="ob-h1">Alder Lake is live on Zonera.</h1>
        <p className="ob-lede">
          <span className="mono">{elapsed()}</span> from your call. Moved before the gate opened at 6:00 am. A separate agent checked every record before the switch.
        </p>
      </header>

      <section className="ob-sec">
        <header className="ob-sec-head">
          <h2 className="ob-sec-h">What moved, and how we checked it</h2>
          <span className="ob-sec-c">Keystone 8.4 → Zonera</span>
        </header>
        <div className="ob-stats">
          {stats.map((s, i) => (
            <div key={s.l} className="ob-stat" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="ob-stat-l">{s.l}</span>
              <span className="ob-stat-v">{s.v.toLocaleString()}</span>
              <span className="ob-stat-f">
                <Check size={12} strokeWidth={2.6} /> {s.f}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="ob-live-grid">
        <section className="ob-box">
          <header className="ob-box-h">
            <h2>What changes for your tenants: nothing.</h2>
          </header>
          <ul className="ob-same">
            <li>
              <KeyRound size={15} />
              <span>Same gate codes</span>
              <em>{N.tenants} synced to PDK</em>
            </li>
            <li>
              <CreditCard size={15} />
              <span>Same autopay</span>
              <em>{N.autopay} cards, no one re-enters</em>
            </li>
            <li>
              <Receipt size={15} />
              <span>Same rent until April</span>
              <em>Held for existing tenants</em>
            </li>
          </ul>
          <div className="ob-live-actions">
            <Button variant="primary" onClick={() => go("ops/overview")}>
              Open your console <ArrowRight />
            </Button>
            <Button onClick={() => go("onboard/home")}>Your checklist</Button>
          </div>
        </section>

        <section className="ob-box">
          <header className="ob-box-h">
            <h2>Dolores and Pier 7 follow the same way</h2>
          </header>
          <ul className="ob-next">
            {DEAL.facilities
              .filter(f => !f.hero)
              .map(f => (
                <li key={f.id}>
                  <span className="ob-kv-ic">
                    <Building2 size={15} />
                  </span>
                  <div>
                    <b>{f.name}</b>
                    <small>
                      <span className="mono">{f.units}</span> units · uses the login you already shared
                    </small>
                  </div>
                  <Pill>Next</Pill>
                </li>
              ))}
          </ul>
          <p className="ob-note">Nothing new needed from you. We'll tell you when each one is live.</p>
        </section>
      </div>
    </div>
  );
}

function NotYet() {
  const o = ownerProgress();
  const p = pct();
  const mine = OWNER_ITEMS.filter(i => fde.items[i.id].state === "open" || fde.items[i.id].state === "waiting");
  const groups = WORK_GROUPS.map(g => ({ g, w: groupWork(g.tasks) })).filter(x => x.w.total && x.w.state !== "done");
  return (
    <div className="ob-page ob-doc-page">
      <div className="ob-wait-hero">
        <Ring value={p / 100} size={64} stroke={5} label={`${p}%`} />
        <div>
          <h1 className="ob-h1">Not live yet</h1>
          <p className="ob-lede">
            {fde.run === "idle" ? "We start as soon as your call with Jordan is in." : `${stageWords()}. Live before Oct 5, when autopay runs.`}
          </p>
        </div>
      </div>

      {fde.run === "idle" ? (
        <div className="ob-live-actions">
          <Button variant="ghost" size="sm" className="ob-presenter" onClick={() => startFde()}>
            <Play /> Start
          </Button>
        </div>
      ) : (
        <div className="ob-live-grid">
          <section className="ob-box">
            <header className="ob-box-h">
              <h2>Left for you</h2>
              <span className="ob-sec-c">{mine.length ? `about ${o.minutes} min` : "Nothing"}</span>
            </header>
            {mine.length ? (
              <ul className="ob-left">
                {mine.map(i => (
                  <li key={i.id}>
                    <span className="ob-wdot ob-wdot--you" />
                    <span>{i.title}</span>
                    <span>{fde.items[i.id].state === "waiting" ? "We're finding it" : i.minutes < 1 ? "<1 min" : `${i.minutes} min`}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ob-note">You've done your part. The rest is on us.</p>
            )}
            <Button variant="primary" onClick={() => go("onboard/home")}>
              Your checklist <ArrowRight />
            </Button>
          </section>
          <section className="ob-box">
            <header className="ob-box-h">
              <h2>Left for us</h2>
            </header>
            <ul className="ob-left">
              {groups.map(({ g, w }) => (
                <li key={g.id}>
                  {w.state === "running" ? <Spinner size={14} /> : <span className="ob-wdot" />}
                  <span>
                    {g.label}
                    {w.now && <span className="ob-note"> · {TASK_WORDS[w.now]}</span>}
                  </span>
                  <span className="mono">
                    {w.done}/{w.total}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
