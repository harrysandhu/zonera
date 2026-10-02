import React, { useEffect, useRef, useState } from "react";
import { Building, Users, Bot, Plug, Headset, Bell, ScrollText, Undo2, Plus, ArrowUpRight, Check, Sparkles, Upload } from "lucide-react";
import { Page, PageHeader, Section } from "../kit";
import { Avatar, Button, Drawer, Pill, Seg } from "../../ui";
import { activity, commit, go, toast, useDemo } from "../../state/store";
import { FACILITY } from "../../data/facility";
import { OPERATOR, TENANTS } from "../../data/tenants";
import { DrawerHead, Field, Switch } from "./a/kit";

type Tier = "auto" | "ask" | "never";

interface Perm {
  id: string;
  group: string;
  name: string;
  desc: string;
  tier: Tier;
  notes: Record<Tier, string>;
  locked?: Tier[];
}

const PERMS: Perm[] = [
  { id: "msg", group: "Customers", name: "Reminders, receipts and replies", desc: "SMS and email to tenants and leads", tier: "auto", notes: { auto: "Sends on its own within quiet hours (8 am–8 pm). 412 messages last month.", ask: "Drafts each message and waits in your inbox. Replies slow to about 2 hours.", never: "Tenants hear from staff only. Payment reminders stop." } },
  { id: "calls", group: "Customers", name: "Outbound calls", desc: "Voice agent calls tenants and leads", tier: "auto", notes: { auto: "Calls during business hours, discloses it's an AI, hands off on request.", ask: "Queues each call for your approval in the call center.", never: "Voice agent answers inbound calls only." } },
  { id: "pay", group: "Money", name: "Take and record payments", desc: "Card, ACH, cash logged by staff", tier: "auto", notes: { auto: "Charges cards on file, records cash, emails receipts, lifts overlocks when paid.", ask: "Prepares the charge; you confirm each one.", never: "Payments are taken by staff in the ledger." } },
  { id: "refund", group: "Money", name: "Refunds and credits", desc: "Duplicate charges, prorations, goodwill", tier: "ask", notes: { auto: "Refunds up to $50 on its own; anything larger still asks.", ask: "Shows the refund with the ledger lines and waits for your approval.", never: "Tells the tenant a manager will follow up within one business day." } },
  { id: "fees", group: "Money", name: "Waive late fees", desc: "One-time courtesy waivers", tier: "ask", notes: { auto: "Waives one late fee per tenant per year when they pay in full.", ask: "Suggests a waiver with the tenant's history; you decide.", never: "Late fees always apply." } },
  { id: "rates", group: "Money", name: "Rate changes", desc: "Existing-customer increases and street rates", tier: "ask", notes: { auto: "Not recommended. Sends notices with the 30 days California requires.", ask: "Builds the impact preview and notices; nothing goes out until you approve.", never: "Rates change only when you edit them." } },
  { id: "gate", group: "Access", name: "Issue and revoke gate codes", desc: "Tenants, vendors, guests", tier: "auto", notes: { auto: "Issues codes limited to a zone and time window; vendor codes expire on their own.", ask: "Prepares the code and waits for you before it works.", never: "Codes are created by staff on the Gate access page." } },
  { id: "lock", group: "Access", name: "Overlock and remove overlocks", desc: "Lock-outs for past-due units", tier: "ask", notes: { auto: "Overlocks at 30 days past due after two notices; removes it the moment they pay.", ask: "Removes overlocks on payment by itself; asks before putting one on.", never: "Staff handle every overlock on site." }, locked: [] },
  { id: "movein", group: "Leases", name: "Move-ins and leases", desc: "ID check, e-sign, gate code", tier: "auto", notes: { auto: "Rents units at street or promo rate, verifies ID, sends the lease to sign.", ask: "Holds the unit and asks you to approve the lease before signing.", never: "Online rentals end at a reservation; staff finish move-in." } },
  { id: "moveout", group: "Leases", name: "Move-outs and final bills", desc: "Proration, inspection, re-listing", tier: "ask", notes: { auto: "Prorates, schedules the inspection, ends access and re-lists the unit.", ask: "Prepares the final bill and waits for the inspection sign-off.", never: "Staff process every move-out." } },
  { id: "vendors", group: "Facility", name: "Work orders and vendors", desc: "Book approved vendors up to $500", tier: "auto", notes: { auto: "Books approved vendors and issues their gate codes; asks above $500.", ask: "Drafts the work order and vendor message for you to send.", never: "The agent only logs issues; you assign them." } },
  { id: "promo", group: "Facility", name: "Promotions on the storefront", desc: "Publish, pause, end", tier: "ask", notes: { auto: "Publishes promos within the floor price you set.", ask: "Previews the storefront change and waits for you.", never: "Promotions are edited by staff only." } },
  { id: "lien", group: "Legal", name: "Lien notices and auctions", desc: "California Self-Service Storage Facility Act", tier: "never", notes: { auto: "Not available. Lien steps need a person.", ask: "Prepares notices on the statutory timeline; a manager signs and sends each one.", never: "Prepares the timeline and reminds you. It never sends a notice or schedules a sale." }, locked: ["auto"] },
];

const SECTIONS = [
  { id: "profile", label: "Facility profile", icon: <Building /> },
  { id: "team", label: "Team", icon: <Users /> },
  { id: "agent", label: "Agent permissions", icon: <Bot /> },
  { id: "integrations", label: "Integrations", icon: <Plug /> },
  { id: "voice", label: "Voice agent", icon: <Headset /> },
  { id: "notifications", label: "Notifications", icon: <Bell /> },
];

const TEAM = [
  { name: OPERATOR.name, email: "priya@zonera-alderlake.com", role: "Facility manager", access: "Full access", last: "Now", tfa: true },
  { name: "Jess Park", email: "jess@zonera-alderlake.com", role: "Assistant manager", access: "Operations", last: "Yesterday", tfa: true },
  { name: "Marco Ruiz", email: "marco@zonera-alderlake.com", role: "Maintenance tech", access: "Maintenance and gate", last: "8:12 am", tfa: false },
  { name: "Daniel Osei", email: "daniel@oseiholdings.com", role: "Owner", access: "Reports, read-only", last: "Oct 1", tfa: true },
];

interface Integ { id: string; name: string; what: string; detail: string; on: boolean; sync: string; mono: string }
const INTEGS: Integ[] = [
  { id: "stripe", name: "Stripe", what: "Payments", detail: "Cards and ACH · payouts daily to Chase •• 6721", on: true, sync: "2 min ago", mono: "S" },
  { id: "twilio", name: "Twilio", what: "SMS and voice", detail: "(530) 555-0142 · 10DLC registered", on: true, sync: "Live", mono: "T" },
  { id: "qbo", name: "QuickBooks Online", what: "Accounting", detail: "Journal entries nightly · class: Alder Lake", on: true, sync: "1:00 am", mono: "QB" },
  { id: "pti", name: "PTI StorLogix", what: "Gates and doors", detail: "6 devices · codes sync in under 2 seconds", on: true, sync: "Live", mono: "PTI" },
  { id: "esign", name: "Zonera Sign", what: "E-signature", detail: "Built in · ESIGN and UETA compliant, audit trail on every lease", on: true, sync: "Built in", mono: "ZS" },
  { id: "google", name: "Google Business Profile", what: "Listing and reviews", detail: "4.8 from 212 reviews · agent replies to new reviews", on: true, sync: "15 min ago", mono: "G" },
  { id: "insure", name: "Storage protection carrier", what: "Tenant protection", detail: `Premiums remitted monthly · ${TENANTS.filter(t => t.protection > 0).length} active plans`, on: true, sync: "Oct 1", mono: "P" },
  { id: "cams", name: "Camera system", what: "Video", detail: "Not connected · lets the agent check footage for incidents", on: false, sync: "—", mono: "C" },
];

const NOTIFS = [
  { e: "Agent needs your approval", v: [true, true, true] },
  { e: "Daily briefing, 7:00 am", v: [true, false, true] },
  { e: "Payment failed", v: [true, false, false] },
  { e: "Gate device offline", v: [true, true, true] },
  { e: "Denied gate attempt", v: [false, false, true] },
  { e: "New reservation or move-in", v: [false, false, true] },
  { e: "Work order updates", v: [true, false, false] },
  { e: "Call escalated to staff", v: [false, true, true] },
];

const AUDIT_SEED = [
  { at: "8:55", text: "Texted Tahoe Gate & Access about the Gate 2 exit sensor", perm: "Work orders and vendors", tier: "auto" as Tier, undo: false },
  { at: "8:53", text: "Switched Gate 2 to keypad exit", perm: "Issue and revoke gate codes", tier: "auto" as Tier, undo: true },
  { at: "8:15", text: "Issued gate code 418 206 to Lakeside Mechanical, 1–5 pm, Building D", perm: "Issue and revoke gate codes", tier: "auto" as Tier, undo: true },
  { at: "8:01", text: "Set C-112 to maintenance and removed it from the storefront", perm: "Work orders and vendors", tier: "auto" as Tier, undo: true },
  { at: "Oct 1", text: "Asked to waive Keiko Cohen's late fee, approved by Priya Raman", perm: "Waive late fees", tier: "ask" as Tier, undo: true },
  { at: "Oct 1", text: "Re-listed D-105 at $79", perm: "Move-outs and final bills", tier: "ask" as Tier, undo: true },
  { at: "Oct 1", text: "Declined to send a lien notice for A-131 and reminded Priya", perm: "Lien notices and auctions", tier: "never" as Tier, undo: false },
];

export default function SettingsPage({ id }: { id?: string }) {
  useDemo();
  const [active, setActive] = useState(id && SECTIONS.some(s => s.id === id) ? id : "profile");
  const [audit, setAudit] = useState(false);
  const refs = useRef<Record<string, HTMLElement | null>>({});

  const jump = (sid: string) => {
    setActive(sid);
    refs.current[sid]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (id && SECTIONS.some(s => s.id === id)) window.setTimeout(() => refs.current[id]?.scrollIntoView({ block: "start" }), 50);
  }, [id]);

  useEffect(() => {
    const root = document.getElementById("os-page");
    if (!root) return;
    const on = () => {
      const top = root.getBoundingClientRect().top + 90;
      let cur = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = refs.current[s.id];
        if (el && el.getBoundingClientRect().top <= top) cur = s.id;
      }
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) cur = SECTIONS[SECTIONS.length - 1].id;
      setActive(cur);
    };
    root.addEventListener("scroll", on, { passive: true });
    return () => root.removeEventListener("scroll", on);
  }, []);

  const reg = (sid: string) => (el: HTMLElement | null) => {
    refs.current[sid] = el;
  };

  return (
    <Page className="pa-settings">
      <PageHeader title="Settings" sub={`${FACILITY.name} · ${FACILITY.address}`} ask="What can the agent do without asking me?" />
      <div className="pa-set">
        <nav className="pa-set-nav" aria-label="Settings sections">
          {SECTIONS.map(s => (
            <button key={s.id} aria-current={active === s.id ? "true" : undefined} onClick={() => jump(s.id)}>
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>
        <div className="pa-set-body">
          <div ref={reg("profile")} className="pa-anchor">
            <Profile />
          </div>
          <div ref={reg("team")} className="pa-anchor">
            <Team />
          </div>
          <div ref={reg("agent")} className="pa-anchor">
            <Permissions onAudit={() => setAudit(true)} />
          </div>
          <div ref={reg("integrations")} className="pa-anchor">
            <Integrations />
          </div>
          <div ref={reg("voice")} className="pa-anchor">
            <Voice />
          </div>
          <div ref={reg("notifications")} className="pa-anchor">
            <Notifications />
          </div>
        </div>
      </div>
      <AuditDrawer open={audit} onClose={() => setAudit(false)} />
    </Page>
  );
}

function Profile() {
  const init = { name: FACILITY.name, phone: FACILITY.phone, address: FACILITY.address, gate: FACILITY.gateHours, office: FACILITY.officeHours, tz: "Pacific Time (Los Angeles)", admin: "25", late: "$15 after 5 days, $45 after 30" };
  const [f, setF] = useState(init);
  const [saved, setSaved] = useState(init);
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Section
      title="Facility profile"
      action={
        <span className="pa-sec-a">
          {dirty && (
            <Button size="sm" variant="ghost" onClick={() => setF(saved)}>
              Discard
            </Button>
          )}
          <Button
            size="sm"
            variant={dirty ? "primary" : "default"}
            disabled={!dirty}
            onClick={() => {
              setSaved(f);
              commit({ kind: "agent", text: "Facility profile updated · storefront and lease templates refreshed", who: OPERATOR.name });
              toast({ title: "Facility profile saved", body: "The storefront, lease template and voice agent use the new details.", tone: "ok" });
            }}
          >
            Save
          </Button>
        </span>
      }
    >
      <div className="pa-form-grid">
        <Field label="Facility name">
          <input className="z-input" value={f.name} onChange={set("name")} />
        </Field>
        <Field label="Phone">
          <input className="z-input" value={f.phone} onChange={set("phone")} />
        </Field>
        <Field label="Address" className="pa-span2">
          <input className="z-input" value={f.address} onChange={set("address")} />
        </Field>
        <Field label="Gate hours">
          <input className="z-input" value={f.gate} onChange={set("gate")} />
        </Field>
        <Field label="Office hours">
          <input className="z-input" value={f.office} onChange={set("office")} />
        </Field>
        <Field label="Time zone">
          <input className="z-input" value={f.tz} onChange={set("tz")} />
        </Field>
        <Field label="Admin fee" hint="Charged once at move-in">
          <input className="z-input" value={f.admin} onChange={set("admin")} />
        </Field>
        <Field label="Late fees" className="pa-span2" hint="Applied by the ledger; the agent can waive one a year if you allow it below">
          <input className="z-input" value={f.late} onChange={set("late")} />
        </Field>
        <Field label="Lien law" className="pa-span2">
          <div className="pa-ud-vendor">
            <b>California Self-Service Storage Facility Act</b>
            <span className="faint">Bus. &amp; Prof. Code §21700–21716 · notices at 14 days, sale no sooner than 14 days after</span>
          </div>
        </Field>
      </div>
    </Section>
  );
}

function Team() {
  const [team, setTeam] = useState(TEAM);
  const [inv, setInv] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Operations");
  return (
    <Section
      title="Team"
      flush
      action={
        <Button size="sm" icon={<Plus />} onClick={() => setInv(v => !v)}>
          Invite
        </Button>
      }
    >
      {inv && (
        <div className="pa-invite">
          <input className="z-input" autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" />
          <select className="z-input pa-select" value={role} onChange={e => setRole(e.target.value)}>
            {["Operations", "Maintenance and gate", "Reports, read-only", "Full access"].map(r => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="primary"
            disabled={!/.+@.+\..+/.test(email)}
            onClick={() => {
              const name = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
              setTeam(t => [...t, { name, email, role: "Invited", access: role, last: "Pending", tfa: false }]);
              toast({ title: `Invite sent to ${email}`, body: `${role} access. The link expires in 7 days.`, tone: "ok" });
              setEmail("");
              setInv(false);
            }}
          >
            Send invite
          </Button>
        </div>
      )}
      <div className="z-table-wrap">
        <table className="z-table pa-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Access</th>
              <th>Two-factor</th>
              <th>Last active</th>
            </tr>
          </thead>
          <tbody>
            {team.map(m => (
              <tr key={m.email}>
                <td>
                  <span className="pa-holder">
                    <Avatar name={m.name} size="sm" />
                    <span>
                      {m.name}
                      <small>{m.email}</small>
                    </span>
                  </span>
                </td>
                <td className="muted">{m.role}</td>
                <td>{m.access}</td>
                <td>{m.tfa ? <Pill tone="ok">On</Pill> : m.last === "Pending" ? <span className="faint">—</span> : <Pill tone="warn">Off</Pill>}</td>
                <td className="mono muted pa-sm">{m.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Permissions({ onAudit }: { onAudit: () => void }) {
  const [tiers, setTiers] = useState<Record<string, Tier>>(() => Object.fromEntries(PERMS.map(p => [p.id, p.tier])));
  const [vendorCap, setVendorCap] = useState("500");
  const [refundCap, setRefundCap] = useState("50");
  const groups = [...new Set(PERMS.map(p => p.group))];
  const n = (t: Tier) => Object.values(tiers).filter(x => x === t).length;
  return (
    <Section
      title={
        <div className="pa-perm-t">
          <h2>Agent permissions</h2>
          <span>
            {n("auto")} auto · {n("ask")} ask first · {n("never")} never
          </span>
        </div>
      }
      flush
      action={
        <Button size="sm" variant="ghost" icon={<ScrollText />} onClick={onAudit}>
          Audit log
        </Button>
      }
    >
      <p className="pa-perm-intro">
        <b>Auto</b> means the agent acts and tells you after. <b>Ask first</b> means it prepares everything and waits for your approval. <b>Never</b> means it refuses and hands the task to a person. Every action lands in the audit log, with undo where the change allows it.
      </p>
      {groups.map(g => (
        <div key={g} className="pa-perm-g">
          <div className="pa-perm-gh mono">{g}</div>
          {PERMS.filter(p => p.group === g).map(p => {
            const t = tiers[p.id];
            return (
              <div key={p.id} className="pa-perm">
                <div className="pa-perm-m">
                  <b>{p.name}</b>
                  <span>{p.desc}</span>
                </div>
                <div className={`pa-perm-seg pa-perm-seg--${t}`}>
                  <Seg
                    value={t}
                    ariaLabel={p.name}
                    onChange={v => {
                      if (p.locked?.includes(v)) {
                        toast({ title: "Not available", body: p.notes[v], tone: "warn" });
                        return;
                      }
                      setTiers(x => ({ ...x, [p.id]: v }));
                      const label = v === "auto" ? "Auto" : v === "ask" ? "Ask first" : "Never";
                      commit({ kind: "agent", text: `Agent permission changed · ${p.name} → ${label}`, who: OPERATOR.name });
                      toast({ title: `${p.name}: ${label}`, body: p.notes[v], tone: "info" });
                    }}
                    options={[
                      { value: "auto", label: "Auto" },
                      { value: "ask", label: "Ask first" },
                      { value: "never", label: "Never" },
                    ]}
                  />
                </div>
                <p className="pa-perm-n" key={t}>
                  <i className={`pa-perm-dot pa-perm-dot--${t}`} />
                  {p.notes[t]}
                </p>
              </div>
            );
          })}
        </div>
      ))}
      <div className="pa-perm-caps">
        <Field label="Book vendors without asking up to">
          <div className="pa-money">
            <span>$</span>
            <input className="z-input" value={vendorCap} onChange={e => setVendorCap(e.target.value.replace(/\D/g, ""))} onBlur={() => toast({ title: `Vendor limit set to $${vendorCap}`, tone: "info" })} />
          </div>
        </Field>
        <Field label="Refund without asking up to">
          <div className="pa-money">
            <span>$</span>
            <input className="z-input" value={refundCap} onChange={e => setRefundCap(e.target.value.replace(/\D/g, ""))} onBlur={() => toast({ title: `Refund limit set to $${refundCap}`, tone: "info" })} />
          </div>
        </Field>
        <Field label="Quiet hours">
          <input className="z-input" defaultValue="8:00 pm – 8:00 am" />
        </Field>
      </div>
    </Section>
  );
}

function Integrations() {
  const [list, setList] = useState(INTEGS);
  const [imp, setImp] = useState<number>(-1);
  const steps = ["Connecting to SiteLink", "Reading 184 tenants and 196 units", "Matching ledgers and gate codes", "Ready to review"];
  return (
    <Section title="Integrations" action={<span className="pa-meta">{list.filter(i => i.on).length} connected</span>}>
      <div className="pa-integ">
        {list.map(i => (
          <div key={i.id} className={`pa-int ${i.on ? "" : "off"}`}>
            <div className="pa-int-h">
              <span className="pa-int-logo mono">{i.mono}</span>
              <div>
                <b>{i.name}</b>
                <span>{i.what}</span>
              </div>
              {i.on ? (
                <Pill tone="ok" dot>
                  Connected
                </Pill>
              ) : (
                <Pill>Off</Pill>
              )}
            </div>
            <p>{i.detail}</p>
            <div className="pa-int-f">
              <span className="mono faint">{i.on ? `Synced ${i.sync}` : "Not connected"}</span>
              <Button
                size="sm"
                variant={i.on ? "ghost" : "default"}
                onClick={() => {
                  setList(l => l.map(x => (x.id === i.id ? { ...x, on: !x.on, sync: !x.on ? "just now" : x.sync, detail: !x.on && x.id === "cams" ? "8 cameras · agent can pull clips for incidents" : x.detail } : x)));
                  toast({ title: i.on ? `${i.name} disconnected` : `${i.name} connected`, tone: i.on ? "warn" : "ok" });
                }}
              >
                {i.on ? "Manage" : "Connect"}
              </Button>
            </div>
          </div>
        ))}
        <div className="pa-int pa-int--import">
          <div className="pa-int-h">
            <span className="pa-int-logo">
              <Upload size={14} />
            </span>
            <div>
              <b>Import from SiteLink or storEDGE</b>
              <span>Bring another facility over</span>
            </div>
          </div>
          {imp < 0 ? (
            <p>Tenants, units, ledgers, gate codes and documents. The agent flags anything that doesn't match before you switch.</p>
          ) : (
            <ul className="pa-imp">
              {steps.map((s, k) => (
                <li key={s} className={k < imp ? "done" : k === imp ? "on" : ""}>
                  {k < imp ? <Check size={12} /> : <i />}
                  {s}
                </li>
              ))}
            </ul>
          )}
          <div className="pa-int-f">
            <span className="mono faint">{imp >= steps.length - 1 ? "Dolores · 3 items to review" : "SiteLink Web · storEDGE"}</span>
            <Button
              size="sm"
              disabled={imp >= 0 && imp < steps.length - 1}
              onClick={() => {
                if (imp >= steps.length - 1) {
                  setImp(-1);
                  toast({ title: "Import review opened", body: "3 tenants have balances that differ by under $5. The agent suggests keeping SiteLink's numbers.", tone: "info" });
                  return;
                }
                setImp(0);
                steps.forEach((_, k) => window.setTimeout(() => setImp(k + 1 >= steps.length ? steps.length - 1 : k + 1), 900 * (k + 1)));
              }}
            >
              {imp >= steps.length - 1 ? "Review" : imp >= 0 ? "Importing" : "Start import"}
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Voice() {
  const [after, setAfter] = useState(true);
  const [payments, setPayments] = useState(true);
  const [record, setRecord] = useState(true);
  return (
    <Section
      title="Voice agent"
      action={
        <Button size="sm" icon={<ArrowUpRight />} onClick={() => go("ops/calls")}>
          Open call center
        </Button>
      }
    >
      <div className="pa-voice">
        <div className="pa-voice-id">
          <span className="pa-voice-ic">
            <Sparkles size={15} />
          </span>
          <div>
            <b>Zonera Voice answers {FACILITY.phone}</b>
            <span>Calm, plain-spoken, says it's an AI in the first sentence. Hands off to staff on request or when it's unsure.</span>
          </div>
        </div>
        <div className="pa-voice-stats">
          <div>
            <span>Answered today</span>
            <b className="tnum">23</b>
          </div>
          <div>
            <span>Resolved by AI</span>
            <b className="tnum">87%</b>
          </div>
          <div>
            <span>Bookings</span>
            <b className="tnum">4</b>
          </div>
          <div>
            <span>Avg handle time</span>
            <b className="tnum">2:41</b>
          </div>
        </div>
        <div className="pa-sw-list">
          <div className="pa-row-sw">
            <div>
              <b>Answer after hours</b>
              <span>6:00 pm – 9:00 am and Sundays. Urgent issues page the on-call manager.</span>
            </div>
            <Switch on={after} onChange={v => (setAfter(v), toast({ title: v ? "After-hours answering on" : "After-hours calls go to voicemail", tone: "info" }))} label="Answer after hours" />
          </div>
          <div className="pa-row-sw">
            <div>
              <b>Take payments by phone</b>
              <span>Card details go straight to Stripe; the agent never hears or stores the number.</span>
            </div>
            <Switch on={payments} onChange={v => (setPayments(v), toast({ title: v ? "Phone payments on" : "Phone payments off", tone: "info" }))} label="Take payments by phone" />
          </div>
          <div className="pa-row-sw">
            <div>
              <b>Record and transcribe calls</b>
              <span>Callers hear a recording notice. Transcripts attach to the tenant profile.</span>
            </div>
            <Switch on={record} onChange={v => (setRecord(v), toast({ title: v ? "Recording on" : "Recording off", tone: "info" }))} label="Record calls" />
          </div>
        </div>
      </div>
    </Section>
  );
}

function Notifications() {
  const [m, setM] = useState(NOTIFS.map(n => n.v));
  return (
    <Section title="Notifications" flush action={<span className="pa-meta">for {OPERATOR.name}</span>}>
      <div className="z-table-wrap">
        <table className="z-table pa-table pa-notif">
          <thead>
            <tr>
              <th>Event</th>
              <th>Email</th>
              <th>SMS</th>
              <th>Push</th>
            </tr>
          </thead>
          <tbody>
            {NOTIFS.map((n, i) => (
              <tr key={n.e}>
                <td>{n.e}</td>
                {[0, 1, 2].map(j => (
                  <td key={j}>
                    <Switch on={m[i][j]} label={`${n.e} ${["email", "SMS", "push"][j]}`} onChange={v => setM(x => x.map((r, a) => (a === i ? r.map((c, b) => (b === j ? v : c)) : r)))} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function AuditDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useDemo();
  const [undone, setUndone] = useState<Set<string>>(new Set());
  const live = activity.filter(a => a.kind === "agent" && !AUDIT_SEED.some(s => s.text === a.text)).slice(0, 6).map(a => ({ at: a.at, text: a.text, perm: a.text.startsWith("Agent permission") ? "Settings change" : a.text.startsWith("Sent autopay") ? "Reminders, receipts and replies" : "Agent action", tier: "auto" as Tier, undo: false }));
  const rows = [...live, ...AUDIT_SEED];
  return (
    <Drawer open={open} onClose={onClose} width={520}>
      <DrawerHead title="Audit log" sub="Everything the agent did, the permission it acted under, and undo where possible." onClose={onClose} />
      <div className="pa-form">
        <ol className="pa-audit">
          {rows.map((r, i) => {
            const k = r.at + r.text;
            const off = undone.has(k);
            return (
              <li key={i} className={off ? "off" : ""}>
                <span className="mono faint pa-audit-t">{r.at}</span>
                <div>
                  <p>{r.text}</p>
                  <span>
                    <i className={`pa-perm-dot pa-perm-dot--${r.tier}`} />
                    {r.perm} · {r.tier === "auto" ? "auto" : r.tier === "ask" ? "asked first" : "refused"}
                  </span>
                </div>
                {r.undo && !off && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Undo2 />}
                    onClick={() => {
                      setUndone(s => new Set(s).add(k));
                      toast({ title: "Undone", body: r.text, tone: "info" });
                    }}
                  >
                    Undo
                  </Button>
                )}
                {off && <span className="faint pa-sm">Undone</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </Drawer>
  );
}
