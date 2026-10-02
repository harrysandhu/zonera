import React, { useState } from "react";
import { KeyRound, Layers, ShieldCheck, Inbox, Lock } from "lucide-react";
import { Pill, Seg, type Tone } from "../../ui";
import { Page, PageHeader, Section, Stat, StatRow, Empty } from "../../ops/kit";
import { fde, useFde, type FeedEvent } from "../fde/engine";
import { RoleBadge, ROLE } from "../fde/widgets";
import { FLEET, ONBOARDINGS } from "../fde/data/portfolio";
import type { Role } from "../fde/types";
import "../../styles/admin-pages.css";

// Policies & vault: what each agent role may do, the credentials leased right now, and the
// audit trail. Leases for Brennan are derived from the live onboarding.

const PRINCIPLES = [
  { icon: ShieldCheck, title: "Two-key rule", body: "The agent that writes data never verifies it. A separate validator VM, with its own role, checks every migration to the cent.", stat: "writer vm-4d90 · checker vm-6c3b" },
  { icon: Layers, title: "Staging first", body: "Agents write to a per-onboarding staging schema. Production changes once, at cutover, after validation passes.", stat: "0 agent writes to prod before cutover" },
  { icon: Lock, title: "Least privilege", body: "Each role gets the narrowest database grants, a domain allow-list and secrets leased for hours, not days.", stat: "median lease 3h 40m" },
  { icon: Inbox, title: "Humans handle exceptions", body: "Agents decide what policy covers. Anything outside it reaches a person with evidence and a recommendation.", stat: "9 escalations this week" },
];

const TEMPLATES: Record<Role, string[]> = {
  analyst: [
    "profile: fde-analyst",
    "vm: { vcpu: 2, mem: 4gb, ttl: task }",
    "db:",
    "  read:  [crm.calls, crm.email, public.*]",
    "  write: [onboarding.requirements]",
    "  prod:  deny",
    "secrets: none",
    "egress:",
    "  allow: [gong.io, gmail.googleapis.com, county-gis]",
    "computer_use: deny",
    "pii:",
    "  card_numbers: never",
    "  transcripts: read  # redacted on export",
    "output: requirements.json + citations",
  ],
  architect: [
    "profile: fde-architect",
    "vm: { vcpu: 2, mem: 4gb, ttl: onboarding }",
    "db:",
    "  read:  [onboarding.*, catalog.*]",
    "  write: [onboarding.plan, staging.config]",
    "  prod:  deny  # cutover runs as a signed job",
    "secrets:",
    "  - docusign/msa      sign-request  ttl: 1h",
    "egress:",
    "  allow: [docusign.net, zonera.com]",
    "computer_use: deny",
    "pii:",
    "  card_numbers: never",
    "approve: owner signs, agent never signs",
  ],
  builder: [
    "profile: fde-builder",
    "vm: { vcpu: 4, mem: 8gb, ttl: task }",
    "db:",
    "  read:  [staging.units, staging.rates]",
    "  write: [staging.storefront, staging.twin]",
    "  prod:  deny",
    "secrets: none",
    "egress:",
    "  allow: [county-gis, maps.googleapis.com]",
    "computer_use: deny",
    "pii:",
    "  card_numbers: never",
    "  tenants: deny",
    "publish: staged until cutover",
  ],
  migrator: [
    "profile: fde-migrator",
    "vm: { vcpu: 4, mem: 8gb, ttl: task }",
    "db:",
    "  read:  [staging.legacy_*]",
    "  write: [staging.legacy_*]",
    "  prod:  deny",
    "secrets:",
    "  - {legacy}/{org}    read          ttl: 4h",
    "egress:",
    "  allow: [*.keystonesm.net, *.sitelink.com, *.storedge.com]",
    "computer_use: sandboxed chromium · recorded",
    "pii:",
    "  card_numbers: never  # tokens only",
    "  ids: read · encrypted at rest",
  ],
  integrator: [
    "profile: fde-integrator",
    "vm: { vcpu: 2, mem: 4gb, ttl: task }",
    "db:",
    "  read:  [staging.*]",
    "  write: [staging.integrations]",
    "  prod:  deny",
    "secrets:",
    "  - {gate}/{site}     credentials   ttl: 8h",
    "  - stripe/{org}      restricted    ttl: 2h",
    "egress:",
    "  allow: [api.pdk.io, api.stripe.com, carrier]",
    "computer_use: deny",
    "pii:",
    "  card_numbers: never  # PCI file transfer",
  ],
  validator: [
    "profile: fde-validator",
    "vm: { vcpu: 4, mem: 8gb, ttl: task, region: separate }",
    "db:",
    "  read:  [staging.*, legacy_snapshot.*]",
    "  write: [onboarding.checks]",
    "  prod:  deny",
    "secrets:",
    "  - {legacy}/{org}    read          ttl: 2h",
    "egress:",
    "  allow: [*.keystonesm.net, api.pdk.io]",
    "computer_use: sandboxed chromium · recorded",
    "pii:",
    "  card_numbers: never  # $0 auth via tokens",
    "rule: never the writer's VM",
  ],
};

function YamlLine({ line }: { line: string }) {
  const [code, comment] = line.split(/(?=  #)/);
  const m = code.match(/^(\s*-?\s*)([\w{}/.-]+)(:)?(.*)$/);
  let body: React.ReactNode = code;
  if (m && m[3]) {
    const val = m[4];
    const tone = /^\s*(deny|never|none)\b/.test(val) ? "sa-po-deny" : "";
    body = (
      <>
        {m[1]}
        <span className="sa-po-k">{m[2]}</span>
        <span className="sa-po-p">:</span>
        <span className={tone}>{val}</span>
      </>
    );
  } else if (m && code.trim().startsWith("-")) {
    body = (
      <>
        {m[1]}
        <span className="sa-po-s">{code.trim().slice(1).trim()}</span>
      </>
    );
  }
  return (
    <div className="sa-po-l">
      {body}
      {comment && <span className="sa-po-c">{comment}</span>}
    </div>
  );
}

type Lease = { path: string; scope: string; vm: string; role: Role; org: string; at: string; ttl: string; status: string; tone: Tone };

function slug(s: string) {
  return s.toLowerCase().replace(/ (storage|self storage|mini storage|storage co\.|group|partners|holdings)$/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// One lease per VM that holds a credential, named for that onboarding's own legacy system or gate.
const PORTFOLIO_LEASES: Lease[] = (() => {
  const out: Lease[] = [];
  const seen = new Set<string>();
  FLEET.forEach((v, i) => {
    if (out.length >= 6 || (v.role !== "migrator" && v.role !== "integrator")) return;
    const o = ONBOARDINGS.find(x => x.org === v.org);
    if (!o) return;
    const legacy = o.from === "Spreadsheets / paper" ? "uploads" : o.from === "Other" ? "legacy" : o.from.toLowerCase().replace(/[^a-z]+/g, "");
    const sys = v.role === "migrator" ? legacy : o.gate === "None" ? "stripe" : o.gate.toLowerCase();
    const path = `${sys}/${slug(v.org)}`;
    if (seen.has(path)) return;
    seen.add(path);
    out.push({ path, scope: v.role === "migrator" ? "read · browser session" : o.gate === "None" ? "restricted" : "credentials", vm: v.id, role: v.role, org: v.org, at: `${(i * 23 + 9) % 60}m ago`, ttl: v.role === "migrator" ? "4h" : "8h", status: "Active", tone: "ok" });
  });
  return out;
})();

function brennanLeases(): Lease[] {
  const live = fde.run === "live";
  const out: Lease[] = [];
  const o1 = fde.items.O1;
  if (o1?.state === "done")
    out.push({ path: "keystone/brennan", scope: "read · rent roll, ledgers, docs", vm: "vm-4d90", role: "migrator", org: "Brennan Storage Co.", at: o1.at ?? "", ttl: "4h", status: live ? "Revoked at cutover" : "Active", tone: live ? "neutral" : "ok" });
  if (fde.tasks.T9 && (fde.tasks.T9.state === "running" || fde.tasks.T9.state === "done"))
    out.push({ path: "keystone-pay/brennan", scope: "PCI file transfer · no card numbers", vm: "vm-5a08", role: "integrator", org: "Brennan Storage Co.", at: fde.tasks.T9.at ?? "", ttl: "1h", status: live || fde.tasks.T9.state === "done" ? "Revoked · transfer done" : "Active", tone: live || fde.tasks.T9.state === "done" ? "neutral" : "ok" });
  if (fde.mails.includes("dealerReply"))
    out.push({ path: "pdk/alder-lake", scope: "credentials, events · site 4471", vm: "vm-5a08", role: "integrator", org: "Brennan Storage Co.", at: "Thu 11:18 am", ttl: "8h", status: live ? "Moved to production" : "Active", tone: live ? "accent" : "ok" });
  if (fde.subscription)
    out.push({ path: "stripe/brennan", scope: "restricted · customers, subscriptions", vm: "vm-5a08", role: "integrator", org: "Brennan Storage Co.", at: fde.tasks.T13?.at ?? "", ttl: "2h", status: live ? "Revoked at cutover" : "Active", tone: live ? "neutral" : "ok" });
  return out;
}

const ACTOR: Record<FeedEvent["who"], string> = { agent: "Agent", owner: "Gail Brennan", vendor: "Vendor", human: "Jordan Lee", system: "Zonera" };

const PORTFOLIO_AUDIT = [
  { at: "Wed 5:58 pm", actor: "vm-6a1f", event: "Lease revoked at cutover: sitelink/ridgeline", org: "Ridgeline Storage" },
  { at: "Wed 5:41 pm", actor: "vm-db36", event: "Validator signed reconciliation · 2,715 units", org: "Mesa Ridge Partners" },
  { at: "Wed 5:20 pm", actor: "Jordan Lee", event: "Approved counter-offer: 2 months free on 10×10 and up", org: "Harbor Self Storage" },
  { at: "Wed 4:52 pm", actor: "policy", event: "Blocked egress to drive.google.com from fde-migrator", org: "Prairie Mini Storage" },
  { at: "Wed 4:30 pm", actor: "vm-e0a9", event: "Lease issued: storedge/lone-star · read · 4h", org: "Lone Star Storage Group" },
  { at: "Wed 3:12 pm", actor: "policy", event: "Denied prod write from fde-builder (staging only)", org: "Willow Storage Co." },
];

export function Policies() {
  useFde();
  const [role, setRole] = useState<"all" | Role>("all");
  const hero = brennanLeases();
  const leases = [...hero, ...PORTFOLIO_LEASES];
  const active = leases.filter(l => l.status === "Active").length;
  const roles = role === "all" ? (Object.keys(TEMPLATES) as Role[]) : [role];

  const audit = [
    ...fde.feed.slice(0, 40).map(e => {
      const actor =
        e.who === "agent"
          ? e.ref ?? e.text.match(/^vm-[0-9a-f]{4}/)?.[0] ?? (/D-209/.test(e.text) ? "vm-6c3b" : /deposit account/.test(e.text) ? "vm-4d90" : /truck rentals/.test(e.text) ? "vm-0a1c" : "vm-2b7e")
          : e.who === "vendor"
            ? /^Marcus/.test(e.text) ? "Marcus Webb" : "vm-5a08"
            : e.who === "human" && /^Escalated/.test(e.text)
              ? "vm-6c3b"
              : e.who === "owner" && /^Priya/.test(e.text)
                ? "Priya Raman"
                : ACTOR[e.who];
      return { key: `f${e.id}`, at: e.at, actor, who: e.who, event: e.text, org: "Brennan Storage Co." };
    }),
    ...PORTFOLIO_AUDIT.map((a, i) => ({ key: `p${i}`, ...a, who: (a.actor === "policy" ? "system" : a.actor.startsWith("vm-") ? "agent" : "human") as FeedEvent["who"] })),
  ];

  return (
    <Page className="sa-po">
      <PageHeader title="Policies & vault" sub="What each agent role may touch, the credentials leased right now, and every action on the record." />

      <StatRow>
        <Stat label="Role templates" value="6" sub="one per agent role" />
        <Stat label="Active leases" value={active} sub="short-lived, auto-revoked" />
        <Stat label="Agent writes to prod" value="0" sub="before a signed cutover" />
        <Stat label="Recorded sessions" value="1,284" sub="this week · full replay" />
      </StatRow>

      <div className="sa-po-principles">
        {PRINCIPLES.map(p => (
          <article key={p.title}>
            <span className="sa-po-ic">
              <p.icon size={15} />
            </span>
            <h3>{p.title}</h3>
            <p>{p.body}</p>
            <small className="mono">{p.stat}</small>
          </article>
        ))}
      </div>

      <Section
        title="Role policies"
        action={
          <Seg
            value={role}
            onChange={setRole}
            ariaLabel="Role"
            options={[{ value: "all" as const, label: "All" }, ...(Object.keys(TEMPLATES) as Role[]).map(r => ({ value: r, label: ROLE[r].label }))]}
          />
        }
      >
        <div className={`sa-po-tpls ${role !== "all" ? "is-one" : ""}`}>
          {roles.map(r => (
            <div key={r} className="sa-po-tpl">
              <div className="sa-po-tpl-h">
                <RoleBadge role={r} />
                <span className="mono faint">fde-{r}.yaml</span>
              </div>
              <pre className="sa-po-code">
                {TEMPLATES[r].map((l, i) => (
                  <YamlLine key={i} line={l} />
                ))}
              </pre>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title={
          <div className="sa-po-sh">
            <h2>Vault leases</h2>
            <span className="mono faint">{active} active</span>
          </div>
        }
        flush
      >
        <div className="z-table-wrap">
          <table className="z-table sa-po-table">
            <thead>
              <tr>
                <th>Secret</th>
                <th>Scope</th>
                <th>Holder</th>
                <th>Onboarding</th>
                <th>Leased</th>
                <th className="num">TTL</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {hero.length === 0 && (
                <tr className="sa-po-wait">
                  <td colSpan={7}>
                    <KeyRound size={13} /> Brennan Storage Co. · no leases yet. The first is issued when Gail shares her Keystone login.
                  </td>
                </tr>
              )}
              {leases.map(l => (
                <tr key={l.path} className={l.org === "Brennan Storage Co." ? "is-hero" : ""}>
                  <td className="mono sa-po-path">{l.path}</td>
                  <td className="muted">{l.scope}</td>
                  <td>
                    <span className="sa-po-holder">
                      <RoleBadge role={l.role} compact />
                      <span className="mono">{l.vm}</span>
                    </span>
                  </td>
                  <td>{l.org}</td>
                  <td className="mono faint">{l.at}</td>
                  <td className="num mono">{l.ttl}</td>
                  <td>
                    <Pill tone={l.tone} dot={l.status === "Active"}>
                      {l.status}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title={
          <div className="sa-po-sh">
            <h2>Audit log</h2>
            <span className="mono faint">append-only · newest first</span>
          </div>
        }
        flush
      >
        <div className="z-table-wrap">
          <table className="z-table sa-po-table sa-po-audit">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Event</th>
                <th>Onboarding</th>
              </tr>
            </thead>
            <tbody>
              {audit.map(a => (
                <tr key={a.key}>
                  <td className="mono faint">{a.at}</td>
                  <td>
                    <span className={`sa-po-actor sa-po-actor--${a.who}`}>
                      <i />
                      <span className={/^vm-/.test(a.actor) ? "mono" : ""}>{a.actor}</span>
                    </span>
                  </td>
                  <td className="sa-po-ev">{a.event}</td>
                  <td className="muted">{a.org}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {audit.length === 0 && <Empty title="Nothing logged yet" />}
        </div>
      </Section>
    </Page>
  );
}
