import React, { useEffect, useRef, useState } from "react";
import { Sparkles, X, ArrowUp, Check, Loader2, Phone, ArrowUpRight, CircleAlert } from "lucide-react";
import { go, toast } from "../../state/store";
import { Button, Pill } from "../../ui";
import { fde, useFde, stage, elapsed, overallProgress, openExceptions } from "../fde/engine";
import { SUMMARY } from "../fde/data/portfolio";
import { N } from "../fde/data/vms";
import { EXCEPTIONS } from "../fde/data/deal";

// Ask HQ: the super admin is agent-native too. Jordan asks; the HQ agent runs tools over
// the portfolio, the fleet and the queue, and answers with something to act on.

type Widget = "needs" | "calls" | "stuck" | "alder" | "incumbents" | "help";
interface Msg {
  id: number;
  role: "user" | "agent";
  text?: string;
  tools?: { name: string; done: boolean; result?: string }[];
  widget?: Widget;
  streaming?: boolean;
}

const SUGGEST = [
  "What needs me today?",
  "Onboard everyone from today's calls",
  "What's stuck, and why?",
  "How did Alder Lake go?",
  "Which incumbents are we winning from?",
];

interface Script {
  match: RegExp;
  tools: [string, string][];
  text: () => string;
  widget: Widget;
}

const SCRIPTS: Script[] = [
  {
    match: /calls|onboard every|start/i,
    tools: [["calls.list({ ended: \"today\" })", "4 calls"], ["context.read × 4", "17 requirements"], ["plan.compile × 3", "3 plans · 9 VMs"], ["policy.check(pricing)", "1 outside policy"]],
    text: () => "Four calls ended today. Three are ready to start now. Cedar Point asked for three free months and policy allows two, so that one needs you first.",
    widget: "calls",
  },
  {
    match: /need|decide|queue|attention/i,
    tools: [["queue.list({ open: true })", "3 decisions"], ["onboarding.list({ blocked_on: \"human\" })", "3 of 63"]],
    text: () => {
      const n = openExceptions().includes("dup") ? 3 : 2;
      return `${n} decisions need you. The other ${63 - n} onboardings are moving without you.`;
    },
    widget: "needs",
  },
  {
    match: /stuck|why|slow|wait/i,
    tools: [["onboarding.list({ idle: \">24h\" })", "5 onboardings"], ["mail.threads({ unanswered: true })", "6 threads"]],
    text: () => "Five onboardings have waited more than a day. Four are waiting on a vendor and one on an owner. Every thread has been nudged; two vendors need a phone call.",
    widget: "stuck",
  },
  {
    match: /alder|brennan|lake/i,
    tools: [["onboarding.get(\"brennan\")", "Alder Lake"], ["validation.report(\"alder-lake\")", "9 checks"]],
    text: () =>
      fde.run === "live"
        ? `Alder Lake went live ${elapsed()} after the call, at 5:45 am, before the gate opened. ${fde.touches} human touch: you merged a duplicate tenant.`
        : fde.run === "idle"
          ? "Brennan's second call just ended. Nothing has started yet; start the FDE from the workspace."
          : `Alder Lake is in ${stage()}, ${Math.round(overallProgress() * 100)}% done. ${fde.touches ? `${fde.touches} human touch so far.` : "No human touches so far."}`,
    widget: "alder",
  },
  {
    match: /incumbent|winning|migrat|sitelink|competit/i,
    tools: [["portfolio.aggregate({ by: \"migrated_from\" })", `${SUMMARY.facilities.toLocaleString()} facilities`]],
    text: () => `${SUMMARY.from[0][1]} of our ${SUMMARY.facilities.toLocaleString()} facilities came from ${SUMMARY.from[0][0]}, and ${SUMMARY.from[1][1]} from ${SUMMARY.from[1][0]}. Spreadsheets and paper are still a big slice of the market.`,
    widget: "incumbents",
  },
];

// Kept at module level so the conversation survives navigating between HQ pages.
const convo: Msg[] = [];
let mseq = 1;

export function AskHq({ open, onClose }: { open: boolean; onClose: () => void }) {
  useFde();
  const [, force] = useState(0);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const rerender = () => force(n => n + 1);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 60);
  }, [open]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  });

  async function ask(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setQ("");
    convo.push({ id: mseq++, role: "user", text });
    const s = SCRIPTS.find(x => x.match.test(text));
    const msg: Msg = { id: mseq++, role: "agent", tools: [], streaming: true };
    convo.push(msg);
    rerender();
    const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
    if (!s) {
      await pause(500);
      msg.text = "I can answer questions about the portfolio, onboardings in flight, the agent fleet and decisions waiting on you. Try one of these.";
      msg.widget = "help";
      msg.streaming = false;
      setBusy(false);
      rerender();
      return;
    }
    for (const [name, result] of s.tools) {
      msg.tools!.push({ name, done: false });
      rerender();
      await pause(520);
      msg.tools![msg.tools!.length - 1] = { name, done: true, result };
      rerender();
    }
    const full = s.text();
    for (let i = 0; i <= full.length; i += 3) {
      msg.text = full.slice(0, i);
      rerender();
      await pause(14);
    }
    msg.text = full;
    msg.widget = s.widget;
    msg.streaming = false;
    setBusy(false);
    rerender();
  }

  return (
    <aside className={`sa-ask ${open ? "open" : ""}`} aria-hidden={!open} aria-label="Ask HQ">
      <header className="sa-ask-h">
        <span className="sa-ask-ic">
          <Sparkles size={14} />
        </span>
        <div>
          <b>Ask HQ</b>
          <small>Portfolio, onboardings, fleet and decisions</small>
        </div>
        <Button variant="ghost" size="sm" iconOnly aria-label="Close" icon={<X size={15} />} onClick={onClose} />
      </header>
      <div className="sa-ask-list" ref={list}>
        {convo.length === 0 && (
          <div className="sa-ask-empty">
            <p>Ask about anything on the platform. The HQ agent runs the same tools the fleet uses, read-only unless you approve.</p>
          </div>
        )}
        {convo.map(m =>
          m.role === "user" ? (
            <div key={m.id} className="sa-ask-u">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="sa-ask-a">
              {m.tools && m.tools.length > 0 && (
                <ul className="sa-ask-tools">
                  {m.tools.map((t, i) => (
                    <li key={i} className={t.done ? "done" : ""}>
                      {t.done ? <Check size={12} /> : <Loader2 size={12} className="sa-spin" />}
                      <span className="mono">{t.name}</span>
                      {t.result && <em>{t.result}</em>}
                    </li>
                  ))}
                </ul>
              )}
              {m.text !== undefined && <p>{m.text}</p>}
              {m.widget && <AskWidget kind={m.widget} onAsk={ask} />}
            </div>
          ),
        )}
      </div>
      <div className="sa-ask-sug">
        {SUGGEST.map(s => (
          <button key={s} onClick={() => ask(s)} disabled={busy}>
            {s}
          </button>
        ))}
      </div>
      <form
        className="sa-ask-in"
        onSubmit={e => {
          e.preventDefault();
          ask(q);
        }}
      >
        <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Ask HQ…" />
        <button type="submit" aria-label="Send" disabled={!q.trim() || busy}>
          <ArrowUp size={15} />
        </button>
      </form>
    </aside>
  );
}

function AskWidget({ kind, onAsk }: { kind: Widget; onAsk: (q: string) => void }) {
  const [started, setStarted] = useState(false);
  const [called, setCalled] = useState<string[]>([]);
  if (kind === "help")
    return (
      <div className="sa-ask-w sa-ask-chips">
        {SUGGEST.map(s => (
          <button key={s} onClick={() => onAsk(s)}>
            {s}
          </button>
        ))}
      </div>
    );
  if (kind === "needs") {
    const rows = [
      ...(openExceptions().includes("dup") ? [{ org: "Brennan Storage Co.", what: EXCEPTIONS.dup.title, rec: "Merge, keep history" }] : []),
      { org: "Mesa Ridge Partners", what: "OpenTech rejected the API key twice", rec: "Call OpenTech support" },
      { org: "Cedar Point Storage", what: "Owner wants 3 free months; policy allows 2", rec: "Offer 2 + first month 50%" },
    ];
    return (
      <div className="sa-ask-w">
        {rows.map(r => (
          <div key={r.org} className="sa-ask-row">
            <CircleAlert size={14} className="warn" />
            <div>
              <b>{r.org}</b>
              <span>{r.what}</span>
              <small>Recommends: {r.rec}</small>
            </div>
          </div>
        ))}
        <Button size="sm" variant="primary" onClick={() => go("admin/queue")}>
          Open Needs you
        </Button>
      </div>
    );
  }
  if (kind === "calls") {
    const rows = [
      { org: "Holloway Storage Group", f: 2, from: "SiteLink", gate: "PTI", ok: true },
      { org: "Bluebird Storage LLC", f: 1, from: "storEDGE", gate: "Noke", ok: true },
      { org: "Granite Peak Storage", f: 6, from: "Easy Storage Solutions", gate: "OpenTech", ok: true },
      { org: "Cedar Point Storage", f: 3, from: "Spreadsheets", gate: "None", ok: false },
    ];
    return (
      <div className="sa-ask-w">
        <table className="sa-ask-t">
          <tbody>
            {rows.map(r => (
              <tr key={r.org}>
                <td>
                  <b>{r.org}</b>
                  <small>
                    {r.f} {r.f === 1 ? "facility" : "facilities"} · {r.from} · {r.gate}
                  </small>
                </td>
                <td>{r.ok ? started ? <Pill tone="ok" dot>Portal sent</Pill> : <Pill tone="accent">Ready</Pill> : <Pill tone="warn">Needs you</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!started ? (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setStarted(true);
              toast({ title: "3 onboardings started", body: "9 VMs booting · 3 portals sent · 0 calls scheduled", tone: "ok", action: { label: "Fleet", route: "admin/fleet" } });
            }}
          >
            Start 3 onboardings
          </Button>
        ) : (
          <span className="sa-ask-note">Started. Cedar Point is waiting in Needs you.</span>
        )}
      </div>
    );
  }
  if (kind === "stuck") {
    const rows = [
      { org: "Mesa Ridge Partners", why: "OpenTech API key rejected twice", age: "31h", call: true },
      { org: "Summit Storage Partners", why: "PTI dealer hasn't replied (2 nudges)", age: "28h", call: true },
      { org: "Prairie Storage Holdings", why: "Bank micro-deposits pending", age: "26h", call: false },
      { org: "Coastal Self Storage Co.", why: "Noke account owner on vacation", age: "26h", call: false },
      { org: "Heritage Self Storage", why: "Owner hasn't signed (opened twice)", age: "25h", call: false },
    ];
    return (
      <div className="sa-ask-w">
        {rows.map(r => (
          <div key={r.org} className="sa-ask-row">
            <span className="mono sa-ask-age">{r.age}</span>
            <div>
              <b>{r.org}</b>
              <span>{r.why}</span>
            </div>
            {r.call &&
              (called.includes(r.org) ? (
                <Pill tone="ok" dot>
                  Calling
                </Pill>
              ) : (
                <Button
                  size="sm"
                  icon={<Phone size={13} />}
                  onClick={() => {
                    setCalled(c => [...c, r.org]);
                    toast({ title: "Zonera Voice is calling", body: `${r.org.split(" ")[0]}'s vendor support line. You'll get the summary.`, tone: "call" });
                  }}
                >
                  Call for me
                </Button>
              ))}
          </div>
        ))}
      </div>
    );
  }
  if (kind === "alder") {
    const live = fde.run === "live";
    return (
      <div className="sa-ask-w">
        <div className="sa-ask-kv">
          <span>Call to live</span>
          <b className="mono">{live ? elapsed() : "—"}</b>
          <span>Human touches</span>
          <b className="mono">{fde.touches}</b>
          <span>Tenants moved</span>
          <b className="mono">{fde.tasks.T6.state === "done" ? N.tenants : "—"}</b>
          <span>Balances</span>
          <b className="mono">{fde.checks.balances === "fixed" || fde.checks.balances === "pass" ? `$${N.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })} to the cent` : "—"}</b>
          <span>Gate codes</span>
          <b className="mono">{fde.checks.gate === "pass" ? `${N.tenants} read back` : "—"}</b>
        </div>
        <Button size="sm" icon={<ArrowUpRight size={13} />} onClick={() => go("admin/onboard/brennan")}>
          Open workspace
        </Button>
      </div>
    );
  }
  // incumbents
  const max = SUMMARY.from[0][1];
  return (
    <div className="sa-ask-w">
      {SUMMARY.from.slice(0, 6).map(([name, n]) => (
        <div key={name} className="sa-ask-bar">
          <span>{name}</span>
          <i>
            <b style={{ width: `${(n / max) * 100}%` }} />
          </i>
          <em className="mono">{n}</em>
        </div>
      ))}
    </div>
  );
}
