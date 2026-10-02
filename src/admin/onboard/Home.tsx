import React, { useState } from "react";
import { Play, ShieldCheck, Check, ArrowRight, CalendarClock, ChevronRight, Sparkles, Mail } from "lucide-react";
import { go } from "../../state/store";
import { Button, Pill, Avatar } from "../../ui";
import { fde, useFde, startFde, ownerProgress, taskProgress, stage, STAGES } from "../fde/engine";
import { Ring } from "../fde/widgets";
import { OWNER_ITEMS, REQ_BY_ID } from "../fde/data/deal";
import type { Stage } from "../fde/types";
import { NeedCard, ConfirmRow } from "./items";
import { Spinner, greeting, pct, stageWords, relTime, WORK_GROUPS, TASK_WORDS, groupWork, taskWork, type WorkState } from "./shared";

export function Home() {
  useFde();
  if (!fde.portalSent) return <Preparing />;
  return (
    <div className="ob-page ob-home">
      {fde.run === "live" && <LiveBanner />}
      <Hero />
      <div className="ob-cols">
        <div className="ob-col-main">
          <Needs />
          <Confirms />
        </div>
        <aside className="ob-col-side" aria-label="What we're doing for you">
          <h2 className="ob-sec-h">What we're doing for you</h2>
          <Feed />
          <Work />
          <People />
          <p className="ob-trustnote">
            <ShieldCheck size={15} />
            <span>Every tenant, balance and gate code is checked by a separate agent before you go live.</span>
          </p>
        </aside>
      </div>
    </div>
  );
}

// ---- before the checklist exists ---------------------------------------------------------

function Preparing() {
  const idle = fde.run === "idle";
  const reqs = fde.reqs.map(id => REQ_BY_ID.get(id)!).filter(Boolean);
  const items = OWNER_ITEMS.filter(i => fde.items[i.id].state !== "hidden");
  const reading = fde.tasks.T1?.state === "running" || fde.tasks.T1?.state === "queued";
  const writing = fde.tasks.T2?.state === "running" || fde.tasks.T2?.state === "queued";
  return (
    <div className="ob-page ob-prep">
      <div className="ob-prep-h">
        <div>
          <p className="ob-eyebrow">{idle ? "Not started" : reading ? "Reading your call" : writing ? "Writing your checklist" : "Almost ready"}</p>
          <h1 className="ob-h1">We're preparing your setup from your call with Jordan.</h1>
          <p className="ob-lede">What you said becomes a checklist that's only yours. Anything we can do ourselves stays off it.</p>
        </div>
        {idle && (
          <Button variant="ghost" size="sm" className="ob-presenter" onClick={() => startFde()}>
            <Play /> Start
          </Button>
        )}
      </div>
      <div className="ob-prep-cols">
        <section className="ob-panel">
          <header className="ob-panel-h">
            <h2>What we heard</h2>
            <span className="mono">{reqs.length}</span>
          </header>
          <ol className="ob-heard">
            {reqs.map(r => (
              <li key={r.id}>
                <Check size={14} className="ob-heard-ok" />
                <div>
                  <b>{r.title}</b>
                  <small>“{r.cites[r.cites.length - 1].quote}”</small>
                </div>
              </li>
            ))}
            {(reading || idle) && (
              <li className="ob-heard-next">
                {idle ? <span className="ob-dot" /> : <Spinner size={13} />}
                <div>
                  <span className="ob-skel" style={{ width: 180 }} />
                  <span className="ob-skel ob-skel--sm" style={{ width: 240 }} />
                </div>
              </li>
            )}
          </ol>
          {idle && <p className="ob-empty">Your call with Jordan and Priya · Sep 30 · 41 min</p>}
        </section>
        <section className="ob-panel">
          <header className="ob-panel-h">
            <h2>What we'll need from you</h2>
            <span className="mono">{items.length}</span>
          </header>
          {items.length ? (
            <ol className="ob-heard ob-heard--items">
              {items.map(i => (
                <li key={i.id}>
                  <span className="ob-dot ob-dot--ring" />
                  <div>
                    <b>{i.title}</b>
                    <small>{i.minutes < 1 ? "Under a minute" : `About ${i.minutes} min`}</small>
                  </div>
                </li>
              ))}
              {writing && (
                <li className="ob-heard-next">
                  <Spinner size={13} />
                  <div>
                    <span className="ob-skel" style={{ width: 150 }} />
                  </div>
                </li>
              )}
            </ol>
          ) : (
            <p className="ob-empty">{writing ? "Writing it now" : "Starts when we've finished reading"}</p>
          )}
        </section>
      </div>
    </div>
  );
}

// ---- hero --------------------------------------------------------------------------------

const RAIL: Record<Stage, string> = { context: "Your call", plan: "Plan", collect: "Your part", migrate: "Move", validate: "Check", live: "Live" };

function Hero() {
  const o = ownerProgress();
  const t = taskProgress();
  const p = pct();
  const cur = stage();
  const idx = STAGES.findIndex(s => s.id === cur);
  const r9 = REQ_BY_ID.get("R9")!;
  const late = OWNER_ITEMS.filter(i => i.late && fde.items[i.id].state === "open");
  const left = o.total - o.done;
  return (
    <section className="ob-hero">
      <h1 className="ob-h1">{greeting()}, Gail.</h1>
      <p className="ob-lede">
        {fde.run === "live"
          ? "Alder Lake moved before the gate opened. Dolores and Pier 7 are next."
          : left > 0
            ? `Here's everything we need to move Alder Lake, Dolores and Pier 7. About ${o.minutes} minute${o.minutes === 1 ? "" : "s"}. We'll do the rest.`
            : "That's everything we need from you. We'll do the rest and tell you when you're live."}
      </p>

      <div className="ob-strip">
        <Ring value={p / 100} size={60} stroke={5} label={`${p}%`} />
        <div className="ob-strip-m">
          <div className="ob-strip-h">
            <b>{stageWords()}</b>
            <span>
              You <span className="mono">{o.done}/{o.total}</span> · Us <span className="mono">{t.done}/{t.total}</span>
            </span>
          </div>
          <ol className="ob-rail" aria-label="Stages">
            {STAGES.map((s, i) => (
              <li key={s.id} className={i < idx || cur === "live" ? "done" : i === idx ? "now" : ""}>
                <i />
                <span>{RAIL[s.id]}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="ob-target">
          <CalendarClock size={16} />
          <div>
            <b>Live before Oct 5, when autopay runs</b>
            <small>“{r9.cites[0].quote}”</small>
          </div>
        </div>
      </div>

      {late.length > 0 && (
        <button type="button" className="ob-added" onClick={() => document.getElementById(`ob-${late[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>
          <span className="ob-added-ic">
            <Mail size={14} />
          </span>
          <span>
            <b>Added from your email this morning.</b> {late[0].title}.
          </span>
          <span className="ob-added-go">
            Review <ChevronRight size={14} />
          </span>
        </button>
      )}
    </section>
  );
}

function LiveBanner() {
  return (
    <button type="button" className="ob-livebar" onClick={() => go("onboard/live")}>
      <span className="ob-check ob-check--lg">
        <Check size={15} strokeWidth={2.6} />
      </span>
      <span className="ob-livebar-t">
        <b>Alder Lake is live on Zonera.</b>
        <span>Every tenant, balance and gate code checked.</span>
      </span>
      <span className="ob-livebar-go">
        See what moved <ArrowRight size={15} />
      </span>
    </button>
  );
}

// ---- the checklist -------------------------------------------------------------------------

function Needs() {
  const items = OWNER_ITEMS.filter(i => i.group === "needs" && fde.items[i.id].state !== "hidden");
  const open = items.filter(i => fde.items[i.id].state !== "done");
  const min = Math.ceil(open.reduce((a, i) => a + i.minutes, 0));
  return (
    <section className="ob-sec">
      <header className="ob-sec-head">
        <h2 className="ob-sec-h">Needs you</h2>
        <span className="ob-sec-c">{open.length ? `${open.length} left · about ${min} min` : "All done"}</span>
      </header>
      <div className="ob-cards">
        {items.map(i => (
          <NeedCard key={i.id} item={i} />
        ))}
      </div>
    </section>
  );
}

function Confirms() {
  const all = OWNER_ITEMS.filter(i => i.group === "confirm" && fde.items[i.id].state !== "hidden");
  const items = [...all.filter(i => i.late), ...all.filter(i => !i.late)];
  const open = items.filter(i => fde.items[i.id].state !== "done");
  return (
    <section className="ob-sec">
      <header className="ob-sec-head">
        <h2 className="ob-sec-h">Quick confirms</h2>
        <span className="ob-sec-c">{open.length ? `${open.length} left · a few seconds each` : "All done"}</span>
      </header>
      <div className="ob-rows">
        {items.map(i => (
          <ConfirmRow key={i.id} item={i} />
        ))}
      </div>
    </section>
  );
}

// ---- side column ------------------------------------------------------------------------------

function Feed() {
  const [all, setAll] = useState(false);
  const events = fde.feed.filter(e => e.owner);
  const shown = all ? events : events.slice(0, 6);
  const running = fde.run === "running";
  return (
    <section className="ob-side-card">
      <header className="ob-side-h">
        <h3>Latest</h3>
        {running ? (
          <span className="ob-livedot">
            <i /> Working now
          </span>
        ) : fde.run === "live" ? (
          <Pill tone="ok" dot>
            Live
          </Pill>
        ) : null}
      </header>
      <ol className="ob-feed">
        {shown.map(e => (
          <li key={e.id} className={`ob-feed-${e.who}`}>
            <i />
            <span className="ob-feed-t">{e.owner}</span>
            <time className="ob-feed-at" title={e.at}>
              {relTime(e.at)}
            </time>
          </li>
        ))}
      </ol>
      {events.length > 6 && (
        <button type="button" className="ob-link ob-link--sm" onClick={() => setAll(a => !a)}>
          {all ? "Show less" : `Show all ${events.length}`}
        </button>
      )}
    </section>
  );
}

const WORK_ICON: Record<WorkState, React.ReactNode> = {
  done: (
    <span className="ob-check ob-check--sm">
      <Check size={10} strokeWidth={3} />
    </span>
  ),
  running: <Spinner size={14} />,
  waiting: <span className="ob-wdot ob-wdot--wait" />,
  you: <span className="ob-wdot ob-wdot--you" />,
  later: <span className="ob-wdot" />,
};

function Work() {
  const [open, setOpen] = useState<string | null>(null);
  const t = taskProgress();
  return (
    <section className="ob-side-card">
      <header className="ob-side-h">
        <h3>Our checklist</h3>
        <span className="ob-side-c mono">
          {t.done}/{t.total}
        </span>
      </header>
      <ul className="ob-work">
        {WORK_GROUPS.map(g => {
          const w = groupWork(g.tasks);
          if (!w.total) return null;
          const isOpen = open === g.id;
          const hasNew = g.tasks.some(id => (id === "T22" || id === "T23") && fde.tasks[id].state !== "hidden" && fde.tasks[id].state !== "done");
          return (
            <li key={g.id} className={`ob-work-g is-${w.state} ${isOpen ? "is-open" : ""}`}>
              <button type="button" className="ob-work-h" onClick={() => setOpen(isOpen ? null : g.id)} aria-expanded={isOpen}>
                <span className="ob-work-ic">{WORK_ICON[w.state]}</span>
                <span className="ob-work-t">
                  <b>
                    {g.label}
                    {hasNew && <Sparkles size={11} className="ob-work-new" />}
                  </b>
                  {w.now && !isOpen && <small>{TASK_WORDS[w.now]}</small>}
                </span>
                <span className="ob-work-c mono">
                  {w.done}/{w.total}
                </span>
                <ChevronRight size={14} className="ob-work-chev" />
              </button>
              {isOpen && (
                <ul className="ob-work-tasks">
                  {w.visible.map(id => {
                    const s = taskWork(id);
                    return (
                      <li key={id} className={`is-${s.state}`}>
                        <span className="ob-work-ic">{WORK_ICON[s.state]}</span>
                        <span className="ob-work-tt">{TASK_WORDS[id]}</span>
                        <span className="ob-work-s">{s.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function People() {
  const priya = fde.items.O8?.state;
  const t10 = fde.tasks.T10?.state;
  return (
    <section className="ob-side-card">
      <header className="ob-side-h">
        <h3>Your people</h3>
      </header>
      <ul className="ob-people">
        <li>
          <Avatar name="Jordan Lee" size="sm" />
          <div>
            <b>Jordan Lee</b>
            <small>Your contact at Zonera</small>
          </div>
          <span className="ob-people-s">jordan@zonera.com</span>
        </li>
        <li>
          <Avatar name="Priya Raman" size="sm" />
          <div>
            <b>Priya Raman</b>
            <small>Manager, Alder Lake</small>
          </div>
          {priya === "done" ? (
            <Pill tone={fde.run === "live" ? "ok" : "neutral"} dot>
              {fde.run === "live" ? "Active" : "Invited"}
            </Pill>
          ) : (
            <span className="ob-people-s">Not invited yet</span>
          )}
        </li>
        <li>
          <Avatar name="Marcus Webb" size="sm" />
          <div>
            <b>Marcus Webb</b>
            <small>Sierra Access · your PDK dealer</small>
          </div>
          {t10 === "done" ? (
            <Pill tone="ok" dot>
              Sent PDK key
            </Pill>
          ) : t10 === "waiting" ? (
            <Pill dot>Asked</Pill>
          ) : t10 === "running" || t10 === "queued" ? (
            <span className="ob-people-s">Emailing now</span>
          ) : (
            <span className="ob-people-s">Not contacted</span>
          )}
        </li>
      </ul>
    </section>
  );
}
