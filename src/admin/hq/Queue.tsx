import React, { useSyncExternalStore } from "react";
import { Check, ShieldCheck, Sparkles, MessageSquare, CircleCheck, Clock, ArrowUpRight, Smartphone } from "lucide-react";
import { go, toast } from "../../state/store";
import { Button, Pill, Avatar } from "../../ui";
import { Page, PageHeader, Section } from "../../ops/kit";
import { fde, useFde, resolveException, clockAt } from "../fde/engine";
import { RoleBadge } from "../fde/widgets";
import { EXCEPTIONS, MAILS } from "../fde/data/deal";
import { ONBOARDINGS } from "../fde/data/portfolio";
import type { Role, Exception } from "../fde/types";
import "../../styles/admin-pages.css";

// Needs you: the only decisions a human makes. Agents resolve everything else, and
// anything the owner's own team can answer is routed to them, not to Jordan.

// ---- standing decisions from other onboardings (module state, shared with mission control) ----

export interface Decision {
  id: string;
  org: string;
  context: string;
  vm: string;
  role: Role;
  age: string;
  title: string;
  detail: string;
  evidence: string[];
  recommendation: string;
  options: { id: string; label: string; primary?: boolean; done: string; toast: string }[];
}

const mesa = ONBOARDINGS.find(o => o.org === "Mesa Ridge Partners");
const lone = ONBOARDINGS.find(o => o.org === "Lone Star Storage Group");
const mesaGate = mesa && mesa.gate !== "None" ? mesa.gate : "PTI";

export const STANDING: Decision[] = [
  {
    id: "mesa",
    org: "Mesa Ridge Partners",
    context: `${mesa?.facilities ?? 14} facilities · ${(mesa?.units ?? 2715).toLocaleString("en-US")} units · validate`,
    vm: "vm-db36",
    role: "validator",
    age: "2h 14m",
    title: `${mesaGate} rejected the API key twice`,
    detail: `Gate code read-back fails on 9 of ${mesa?.facilities ?? 14} sites. The dealer-issued key returns 401 on credentials.write; reads work. Two retries with a fresh vault lease failed the same way.`,
    evidence: ["POST /credentials → 401 at 7:12 am and 7:41 am", `GET /sites → 200 · ${mesa?.facilities ?? 14} sites listed`, "Key scope on file: read-only (issued Tue by the dealer)", "5 sites already pass read-back with the older key"],
    recommendation: "Ask the dealer to reissue the key with write scope. Draft email is ready, owner copied. Cutover holds for these 9 sites only.",
    options: [
      { id: "email", label: "Send to dealer", primary: true, done: "Dealer emailed", toast: "Email sent to the dealer, owner copied. The integrator retries when the new key lands." },
      { id: "call", label: "I'll call the dealer", done: "Jordan is calling the dealer", toast: "Assigned to you. The validator keeps the 9 sites on hold." },
      { id: "skip", label: "Cut over without gate sync", done: "Cut over without gate sync", toast: "9 sites will cut over with manual gate codes. The agent flags each move-in." },
    ],
  },
  {
    id: "promo",
    org: "Lone Star Storage Group",
    context: `${lone?.facilities ?? 6} facilities · ${(lone?.units ?? 2865).toLocaleString("en-US")} units · collect`,
    vm: "vm-7c21",
    role: "architect",
    age: "47m",
    title: "Owner wants a 3-month free promo outside policy",
    detail: "Asked on the plan review: 3 months free for new move-ins at all six sites through December. Policy caps promotions at 1 month without approval.",
    evidence: ["promo.max_free_months = 1 (portfolio policy)", "Occupancy 81% across the six sites, 74% at Round Rock", "Projected cost ≈ $11,400 at 38 move-ins a month", "Two operators were approved at 2 months this quarter"],
    recommendation: "Counter with 2 months free on 10×10 and larger and 1 month on small units. Keeps cost near $6,900.",
    options: [
      { id: "counter", label: "Approve counter-offer", primary: true, done: "Counter-offer approved", toast: "Counter-offer sent to the owner for a yes. The architect updates the rate plan on accept." },
      { id: "approve", label: "Approve 3 months", done: "3 months approved", toast: "Approved as asked. Logged as a policy exception on the account." },
      { id: "decline", label: "Decline", done: "Declined", toast: "Declined. The agent explains the 1-month policy to the owner." },
    ],
  },
];

const decided: Record<string, { choice: string; label: string; at: string } | undefined> = {};
let ver = 0;
const subs = new Set<() => void>();
const sub = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};
export function useStanding() {
  return useSyncExternalStore(sub, () => ver, () => ver);
}
export function standingOpen() {
  return STANDING.filter(d => !decided[d.id]);
}
export function decideStanding(id: string, choice: string) {
  const d = STANDING.find(x => x.id === id);
  const o = d?.options.find(x => x.id === choice);
  if (!d || !o || decided[id]) return;
  decided[id] = { choice, label: o.done, at: clockAt() };
  ver++;
  subs.forEach(f => f());
  toast({ title: `${o.done} · ${d.org}`, body: o.toast, tone: "ok" });
}

/** Everything in the queue right now: Brennan's live exception plus the standing ones. */
export function queueItems() {
  const items: { id: string; title: string; org: string; hot?: boolean }[] = [];
  if (fde.exc.dup?.state === "open") items.push({ id: "dup", title: EXCEPTIONS.dup.title, org: "Brennan Storage Co.", hot: true });
  standingOpen().forEach(d => items.push({ id: d.id, title: d.title, org: d.org }));
  return items;
}

// ---- page -----------------------------------------------------------------------------

export function Queue() {
  useFde();
  useStanding();
  const dup = fde.exc.dup ?? { state: "hidden" };
  const size = fde.exc.size ?? { state: "hidden" };
  const open = queueItems().length;

  return (
    <Page className="sa-q">
      <PageHeader
        title="Needs you"
        sub="The only decisions a person makes. Agents resolve the rest, and the owner's team answers what only they know."
        actions={
          <span className="sa-q-count">
            <b className="tnum">{open}</b> open
          </span>
        }
      />

      <div className="sa-q-strip">
        <span>
          <ShieldCheck size={14} /> Auto-resolved by agents this week <b className="tnum">214</b>
        </span>
        <i />
        <span>
          Escalated to a human <b className="tnum">9</b>
        </span>
        <i />
        <span>
          Median time to decide <b className="tnum">6m</b>
        </span>
      </div>

      <div className="sa-q-list">
        <div className="sa-q-group">
          <div className="sa-q-gh">
            <span>Brennan Storage Co.</span>
            <small>Alder Lake · Automated FDE</small>
          </div>
          {dup.state === "open" ? (
            <ExceptionCard exc={EXCEPTIONS.dup} at={dup.at} onPick={id => resolveException("dup", id)} />
          ) : dup.state === "resolved" ? (
            <Resolved
              title={EXCEPTIONS.dup.title}
              line={`${dup.choice === "merge" ? "Merged" : "Kept separate"} by Jordan Lee · ${dup.at}`}
              note={dup.choice === "merge" ? "2023 history kept as a past rental. The validator re-ran the people check." : "Two tenant records kept. The validator noted the shared phone and license."}
            />
          ) : (
            <div className="sa-q-quiet">
              <ShieldCheck size={15} />
              <span>{fde.run === "idle" ? "Onboarding hasn't started. Nothing to decide." : "Validator hasn't flagged anything."}</span>
              {fde.run !== "idle" && (
                <button className="sa-q-link" onClick={() => go("admin/onboard/brennan")}>
                  Open workspace <ArrowUpRight size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        {STANDING.map(d => {
          const done = decided[d.id];
          return (
            <div className="sa-q-group" key={d.id}>
              <div className="sa-q-gh">
                <span>{d.org}</span>
                <small>{d.context}</small>
              </div>
              {done ? (
                <Resolved title={d.title} line={`${done.label} by Jordan Lee · ${done.at}`} />
              ) : (
                <DecisionCard d={d} />
              )}
            </div>
          );
        })}
      </div>

      <Section
        title={
          <div className="sa-q-sh">
            <h2>Routed to the owner's team, not to you</h2>
            <span className="faint">Facts only someone on site knows. The agent texts them and waits.</span>
          </div>
        }
      >
        <div className="sa-q-owner">
          <OwnerRouted state={size.state} at={size.at} />
          <div className="sa-q-past">
            {PAST_OWNER.map(p => (
              <div key={p.title} className="sa-q-past-r">
                <CircleCheck size={14} />
                <div>
                  <b>{p.title}</b>
                  <span>
                    {p.org} · {p.who}
                  </span>
                </div>
                <small className="mono">{p.age}</small>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Decided this week" flush>
        <div className="z-table-wrap">
          <table className="z-table sa-q-table">
            <thead>
              <tr>
                <th>Decision</th>
                <th>Onboarding</th>
                <th>Raised by</th>
                <th>Outcome</th>
                <th className="num">Took</th>
              </tr>
            </thead>
            <tbody>
              {PAST.map(p => (
                <tr key={p.title}>
                  <td>{p.title}</td>
                  <td className="muted">{p.org}</td>
                  <td>
                    <RoleBadge role={p.role} />
                  </td>
                  <td className="muted">{p.outcome}</td>
                  <td className="num mono">{p.took}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </Page>
  );
}

function ExceptionCard({ exc, at, onPick }: { exc: Exception; at?: string; onPick: (id: string) => void }) {
  return (
    <article className="sa-q-card sa-q-card--hot">
      <header className="sa-q-ch">
        <Pill tone="warn" dot live>
          Needs you
        </Pill>
        <RoleBadge role="validator" />
        <span className="mono faint">vm-6c3b</span>
        <span className="sa-q-age">
          <Clock size={12} /> {at ?? clockAt()}
        </span>
      </header>
      <h3>{exc.title}</h3>
      <p className="sa-q-detail">{exc.detail}</p>
      <ul className="sa-q-ev">
        {exc.evidence.map(e => (
          <li key={e}>
            <Check size={12} />
            <span>{e}</span>
          </li>
        ))}
      </ul>
      <div className="sa-q-rec">
        <Sparkles size={14} />
        <div>
          <small>Validator recommends</small>
          <p>{exc.recommendation}</p>
        </div>
      </div>
      <footer className="sa-q-opts">
        {exc.options.map(o => (
          <Button key={o.id} variant={o.primary ? "accent" : "default"} onClick={() => onPick(o.id)}>
            {o.label}
          </Button>
        ))}
        <span className="faint sa-q-hint">Your call is logged and the validator re-runs the check.</span>
      </footer>
    </article>
  );
}

function DecisionCard({ d }: { d: Decision }) {
  return (
    <article className="sa-q-card">
      <header className="sa-q-ch">
        <Pill tone="warn" dot>
          Needs you
        </Pill>
        <RoleBadge role={d.role} />
        <span className="mono faint">{d.vm}</span>
        <span className="sa-q-age">
          <Clock size={12} /> open {d.age}
        </span>
      </header>
      <h3>{d.title}</h3>
      <p className="sa-q-detail">{d.detail}</p>
      <ul className="sa-q-ev">
        {d.evidence.map(e => (
          <li key={e}>
            <Check size={12} />
            <span>{e}</span>
          </li>
        ))}
      </ul>
      <div className="sa-q-rec">
        <Sparkles size={14} />
        <div>
          <small>{d.role === "validator" ? "Validator" : "Architect"} recommends</small>
          <p>{d.recommendation}</p>
        </div>
      </div>
      <footer className="sa-q-opts">
        {d.options.map(o => (
          <Button key={o.id} variant={o.primary ? "accent" : "default"} onClick={() => decideStanding(d.id, o.id)}>
            {o.label}
          </Button>
        ))}
      </footer>
    </article>
  );
}

function Resolved({ title, line, note }: { title: string; line: string; note?: string }) {
  return (
    <article className="sa-q-card sa-q-card--done">
      <CircleCheck size={16} className="sa-q-ok" />
      <div>
        <b>{title}</b>
        <span>{line}</span>
        {note && <p>{note}</p>}
      </div>
    </article>
  );
}

function OwnerRouted({ state, at }: { state: string; at?: string }) {
  const exc = EXCEPTIONS.size;
  const sms = fde.mails.includes("priyaSms");
  const reply = fde.mails.includes("priyaReply");
  if (state === "hidden")
    return (
      <div className="sa-q-quiet sa-q-quiet--box">
        <Smartphone size={15} />
        <span>Nothing routed to Brennan's team yet. If the validator finds a fact only Priya knows, it texts her.</span>
      </div>
    );
  return (
    <article className="sa-q-card sa-q-card--owner">
      <header className="sa-q-ch">
        {state === "resolved" ? (
          <Pill tone="ok" dot>
            Answered by Priya
          </Pill>
        ) : (
          <Pill tone="info" dot live>
            Waiting on Priya
          </Pill>
        )}
        <span className="faint">Brennan Storage Co. · Alder Lake</span>
        <span className="sa-q-age">
          <Clock size={12} /> {at}
        </span>
      </header>
      <h3>{exc.title}</h3>
      <p className="sa-q-detail">{exc.detail}</p>
      <ul className="sa-q-ev">
        {exc.evidence.map(e => (
          <li key={e}>
            <Check size={12} />
            <span>{e}</span>
          </li>
        ))}
      </ul>
      <div className="sa-q-thread">
        <div className="sa-q-thread-h">
          <MessageSquare size={13} /> SMS · Priya Raman · (530) 555-0142
        </div>
        {!sms && <div className="sa-q-typing">Texting when the office opens at 8:00 am…</div>}
        {sms && (
          <div className="sa-q-msg sa-q-msg--out">
            <p>{MAILS.priyaSms.body}</p>
            <small>Zonera onboarding · {MAILS.priyaSms.when.replace(/^\w+ \w+ \d+ · /, "")}</small>
          </div>
        )}
        {sms && !reply && <div className="sa-q-typing">Priya is typing…</div>}
        {reply && (
          <div className="sa-q-msg sa-q-msg--in">
            <Avatar name="Priya Raman" size="sm" />
            <div>
              <p>{MAILS.priyaReply.body}</p>
              <small>Priya Raman · {MAILS.priyaReply.when.replace(/^\w+ \w+ \d+ · /, "")}</small>
            </div>
          </div>
        )}
        {reply && (
          <div className="sa-q-applied">
            <CircleCheck size={13} /> D-209 corrected to 10×10 in staging · storefront price follows · no one at Zonera touched it
          </div>
        )}
      </div>
    </article>
  );
}

const PAST_OWNER = [
  { title: "Gate hours differ between website and PTI", org: "Lakeside Self Storage", who: "manager confirmed 6 am – 10 pm", age: "Tue" },
  { title: "Is unit 114 a parking space or a 10×20?", org: "Desert Sky Storage Co.", who: "owner replied by text", age: "Mon" },
  { title: "Which bank account takes the Q4 payouts?", org: "Magnolia Mini Storage", who: "owner picked in portal", age: "Mon" },
];

const PAST: { title: string; org: string; role: Role; outcome: string; took: string }[] = [
  { title: "Two tenants share one gate code", org: "Summit Storage Co.", role: "validator", outcome: "Split codes, texted both tenants", took: "4m" },
  { title: "Lien sale scheduled during cutover week", org: "Harbor Self Storage", role: "architect", outcome: "Moved cutover to Monday", took: "11m" },
  { title: "storEDGE ledger off by $1,204.50", org: "Redwood Self Storage", role: "validator", outcome: "Accepted agent's fix, refunds posted", took: "7m" },
  { title: "Owner asked to keep paper leases", org: "Prairie Storage Co.", role: "architect", outcome: "Scanned on site, e-sign for new leases", took: "3m" },
  { title: "Noke locks on 12 units not in the rent roll", org: "Northgate Self Storage", role: "integrator", outcome: "Marked as company units", took: "5m" },
];
