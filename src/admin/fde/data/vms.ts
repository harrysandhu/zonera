import type { Vm, Step, Check } from "../types";
import { UNITS } from "../../../data/facility";
import { TENANTS } from "../../../data/tenants";

// The facility's real numbers, so HQ, the owner portal and the operator console agree.
export const N = {
  units: UNITS.length,
  tenants: TENANTS.length,
  autopay: TENANTS.filter(t => t.autopay).length,
  protection: TENANTS.filter(t => t.protection > 0).length,
  balance: TENANTS.reduce((a, t) => a + t.balance, 0),
  late: TENANTS.filter(t => t.daysLate > 0).length,
  ledger: 4212,
  docs: 388,
};

const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const KS = "https://brennan.keystonesm.net";

const s = (kind: Step["kind"], text: string, wait = 520, extra: Partial<Step> = {}): Step => ({ kind, text, wait, ...extra });

// Every VM runs a Codex harness pinned to a role profile. Scripts are keyed by task.
export const VMS: Vm[] = [
  {
    id: "vm-0a1c", role: "analyst", profile: "fde-analyst", label: "Transcript analyst", region: "us-west-2", vcpu: 2, memGb: 4, browser: false,
    scripts: [
      {
        task: "T1",
        steps: [
          s("cmd", "codex exec --profile fde-analyst --onboarding brennan", 200),
          s("tool", "context.load calls/c1.vtt (27 min) · calls/c2.vtt (41 min) · gmail/thread-8812", 700),
          s("tool", "context.load web alderlakestorage.com · google profile · parcel 032-141-07", 600),
          s("think", "Three sites, 461 units. One owner, one manager. Legacy PMS + PDK gate.", 900, { fire: "line:c1-0031" }),
          s("ok", "R1  Move everything out of Keystone 8.4            c1 01:09 · c1 12:05", 900, { fire: "line:c1-0109|req:R1" }),
          s("ok", "R2  One gate code system (PDK)                     c1 02:48 · c2 00:27", 900, { fire: "line:c1-0248|req:R2" }),
          s("ok", "R3  Automate the late-payment playbook             c1 04:21 · c2 09:31", 900, { fire: "line:c1-0421|req:R3" }),
          s("ok", "R7  Answer calls after 6 pm                        c1 06:06", 800, { fire: "line:c1-0606|req:R7" }),
          s("ok", "R6  Rent online                                    c1 08:30", 800, { fire: "line:c1-0830|req:R6" }),
          s("ok", `R8  ${N.autopay} autopays keep working                     c1 11:18`, 800, { fire: "line:c1-1118|req:R8" }),
          s("ok", "R4  Attorney's lease, word for word                c1 14:22", 800, { fire: "line:c1-1422|req:R4" }),
          s("ok", "R5  Hold existing rates for 6 months               c2 05:44", 800, { fire: "line:c2-0544|req:R5" }),
          s("ok", "R10 Payouts to Sierra Pacific                      c2 13:05", 800, { fire: "line:c2-1305|req:R10" }),
          s("ok", "R11 Manager login without financials               c2 16:40", 800, { fire: "line:c2-1640|req:R11" }),
          s("ok", "R12 Join the Zonera network brand                  c2 21:18", 800, { fire: "line:c2-2118|req:R12" }),
          s("ok", "R13 Professional · 60d free · 12 mo · lock 24 mo    c2 27:02", 800, { fire: "line:c2-2702|req:R13" }),
          s("ok", "R9  Live before the Oct 5 autopay run              c2 34:02", 800, { fire: "line:c2-3402|req:R9" }),
          s("tool", "graph.write requirements.json · 13 requirements · 20 citations", 600, { fire: "line:" }),
          s("note", "done in 2m 11s · 38.2k tokens", 300),
        ],
      },
      {
        task: "T23",
        steps: [
          s("tool", "context.update gmail/thread-8812 · +1 message from Gail, 7:52 am", 700, { fire: "line:e1-0752" }),
          s("ok", "R14 Truck rentals at the front desk                e1 07:52", 900, { fire: "req:R14" }),
          s("tool", "schema.patch +O12 confirm · plan.patch +T22 (builder)", 700, { fire: "item:O12|task:T22" }),
          s("note", "owner portal updated in place · no new email needed", 300, { fire: "line:" }),
        ],
      },
    ],
  },
  {
    id: "vm-2b7e", role: "architect", profile: "fde-architect", label: "Onboarding architect", region: "us-west-2", vcpu: 2, memGb: 4, browser: false,
    scripts: [
      {
        task: "T2",
        steps: [
          s("cmd", "codex exec --profile fde-architect --task compile-plan", 200),
          s("tool", "catalog.match requirements.json → 14 capabilities", 700),
          s("tool", "plan.compile → 22 tasks · 8 VMs · critical path keystone → validate → cutover", 800, { fire: "plan" }),
          s("tool", "schema.generate owner-checklist (no template)", 600),
          s("out", "+ O1  credential  Keystone login  (replaces 3 exports)", 380, { fire: "item:O1" }),
          s("out", "+ O2  delegate    PDK access via Marcus Webb", 380, { fire: "item:O2" }),
          s("out", "+ O3  upload      Lease, March revision", 380, { fire: "item:O3" }),
          s("out", "+ O4  confirm     Late-payment playbook, prefilled from c2 09:31", 380, { fire: "item:O4" }),
          s("out", "+ O5  choice      Rate hold for existing tenants", 380, { fire: "item:O5" }),
          s("out", "+ O6  choice      Storefront name", 380, { fire: "item:O6" }),
          s("out", "+ O7  form        Payout account (we'll find it in Keystone)", 380, { fire: "item:O7" }),
          s("out", "+ O8  form        Invite Priya, manager, no financials", 380, { fire: "item:O8" }),
          s("out", "+ O9  confirm     After-hours calls", 380, { fire: "item:O9" }),
          s("out", "+ O10 sign        MSA generated from c2 27:02–27:26", 380, { fire: "item:O10|flow:CONTRACT_GENERATED" }),
          s("out", "+ O11 pay         Subscription, nothing charged until Dec 1", 380, { fire: "item:O11" }),
          s("tool", "portal.publish onboard/brennan → gail@brennanstorage.com", 700, { fire: "mail:portal|flow:AWAITING_SIGNING" }),
          s("ok", "11 owner items · about 9 minutes of Gail's time · 0 calls scheduled", 300),
        ],
      },
      {
        task: "T14",
        steps: [
          s("tool", "doc.parse Brennan_Rental_Agreement_2026-03.pdf (14 pp)", 600),
          s("out", "lien notice found p. 9 · late fee $25 p. 4 · overlock clause p. 5", 600),
          s("tool", "lease.template create --verbatim · 31 merge fields", 600),
          s("tool", "lien.workflow load ca-self-service-storage-act · preliminary notice day 14", 600),
          s("ok", "lease + lien workflow ready", 300),
        ],
      },
      {
        task: "T15",
        steps: [
          s("tool", "collections.playbook set d1 sms · d6 fee $25 · d10 overlock · d14 lien notice", 600),
          s("tool", `dry-run on staging ledger → ${N.late} late · 4 texts · 3 fees · 1 overlock tomorrow`, 700),
          s("ok", "playbook armed for cutover", 300),
        ],
      },
      {
        task: "T16",
        steps: [
          s("tool", `rates.guard existing=hold until 2027-04-02 · ${N.tenants} leases tagged`, 600),
          s("ok", "no rent changes at cutover", 300),
        ],
      },
      {
        task: "T17",
        steps: [
          s("tool", "users.invite priya@brennanstorage.com role=manager deny=[payouts, owner_reports]", 600),
          s("ok", "invite sent", 300),
        ],
      },
      {
        task: "T21",
        steps: [
          s("cmd", "zonera cutover alder-lake --at 05:45 --before-gate 06:00", 400, { fire: "clock:cutover" }),
          s("tool", "keystone.freeze read-only · final delta pull: 0 payments · 1 gate event", 800),
          s("tool", `promote staging.alder_lake → prod · ${N.tenants} tenants · ${N.units} units · ${N.ledger.toLocaleString()} ledger lines`, 1000),
          s("tool", "pdk.authority = zonera · keystone gate sync disabled", 600),
          s("tool", "storefront zonera.com/alder-lake · phones forward 18:00–09:00", 600),
          s("ok", "live at 05:45:12 · 15 minutes before the gate opens", 400, { fire: "live" }),
        ],
      },
    ],
  },
  {
    id: "vm-3c4d", role: "builder", profile: "fde-builder", label: "Twin + storefront", region: "us-west-2", vcpu: 4, memGb: 8, browser: false,
    scripts: [
      {
        task: "T3",
        steps: [
          s("tool", "http GET county parcel 032-141-07 → 4.1 acres · built 1998 · permits 2014, 2019", 700),
          s("tool", "http GET google profile → 4.6 (212 reviews) · hours · 38 photos", 600),
          s("tool", "crawl alderlakestorage.com → 3 pages · phone number only · no inventory", 600),
          s("ok", "public data saved", 300),
        ],
      },
      {
        task: "T4",
        steps: [
          s("tool", "vision.extract permits/2014-site-plan.pdf → 6 buildings · 181 doors", 900),
          s("tool", "satellite.align 2026-08 tile → drive aisles, gate, office", 700),
          s("tool", "twin.build → alder-lake.glb", 800, { fire: "twin" }),
          s("ok", "3D twin drafted · will reconcile to Keystone unit list", 300),
        ],
      },
      {
        task: "T5",
        steps: [
          s("tool", "storefront.generate brand=zonera-network name=“Zonera Alder Lake”", 700),
          s("tool", "pricing.import street rates from staging · 7 sizes", 600),
          s("ok", "storefront staged at zonera.com/alder-lake", 300),
        ],
      },
      {
        task: "T22",
        steps: [
          s("think", "New requirement from Gail's 7:52 am email. Adding a partner desk.", 600),
          s("tool", "partner.desk add u-haul neighborhood dealer · storefront card", 700),
          s("tool", "agent.skill enable trucks.quote · trucks.reserve (dealer portal)", 600),
          s("ok", "truck rentals live on storefront + agent", 300),
        ],
      },
    ],
  },
  {
    id: "vm-4d90", role: "migrator", profile: "fde-migrator", label: "Keystone · rent roll", region: "us-west-2", vcpu: 4, memGb: 8, browser: true,
    scripts: [
      {
        task: "T6",
        steps: [
          s("cmd", "codex exec --profile fde-migrator --task keystone-rent-roll", 200),
          s("tool", "vault.lease keystone/brennan · read · ttl 4h", 600),
          s("tool", `browser.open ${KS}/login`, 700, { frame: { screen: "login", url: `${KS}/login` } }),
          s("tool", "browser.type #username “gail.brennan”", 700, { frame: { screen: "login", url: `${KS}/login`, focus: "user", typed: "gail.brennan" } }),
          s("tool", "browser.type #password ••••••••••", 600, { frame: { screen: "login", url: `${KS}/login`, focus: "pass", typed: "gail.brennan" } }),
          s("tool", "browser.click “Sign in”", 700, { frame: { screen: "login", url: `${KS}/login`, focus: "signin", typed: "gail.brennan" } }),
          s("tool", "browser.click Reports ▸ Rent roll", 900, { frame: { screen: "home", url: `${KS}/main.aspx`, focus: "reports" } }),
          s("tool", "browser.select Site “Alder Lake” · As of 09/30/2026", 800, { frame: { screen: "reports", url: `${KS}/reports/rentroll.aspx`, focus: "site" } }),
          s("tool", "browser.click “Run report”", 800, { frame: { screen: "reports", url: `${KS}/reports/rentroll.aspx`, focus: "run" } }),
          s("out", `page 1/7 … 7/7 · ${N.tenants} tenants · ${N.units} units`, 1100, { frame: { screen: "rentroll", url: `${KS}/reports/rentroll.aspx?run=1`, focus: "rows" } }),
          s("tool", "browser.click Export ▸ CSV → /work/raw/rent_roll.csv", 800, { frame: { screen: "rentroll", url: `${KS}/reports/rentroll.aspx?run=1`, focus: "export" } }),
          s("tool", "browser.open Setup ▸ Deposit accounts", 800, { frame: { screen: "deposits", url: `${KS}/setup/deposits.aspx`, focus: "acct" } }),
          s("out", "deposit account: Sierra Pacific Credit Union ••••0918", 600, { fire: "found:bank" }),
          s("tool", `psql staging.alder_lake \\copy legacy_tenants (${N.tenants}) legacy_units (${N.units})`, 800),
          s("ok", "rent roll, units, rates, deposit settings · 4m 52s", 300),
        ],
      },
    ],
  },
  {
    id: "vm-4e12", role: "migrator", profile: "fde-migrator", label: "Keystone · ledgers", region: "us-west-2", vcpu: 2, memGb: 4, browser: true, parent: "vm-4d90",
    scripts: [
      {
        task: "T7",
        steps: [
          s("note", "sub-agent of vm-4d90 · shared browser session", 300),
          s("tool", "browser.open Tenants ▸ Ledger history (bulk)", 900, { frame: { screen: "ledger", url: `${KS}/tenants/ledger.aspx?bulk=1`, focus: "rows" } }),
          s("out", `${N.tenants} ledgers · ${N.ledger.toLocaleString()} lines · 2019-05 → 2026-09`, 1200, { frame: { screen: "ledger", url: `${KS}/tenants/ledger.aspx?bulk=1&page=31`, focus: "rows" } }),
          s("tool", `psql staging.alder_lake \\copy legacy_ledger (${N.ledger.toLocaleString()})`, 800),
          s("ok", "ledgers and payment history · 6m 03s", 300),
        ],
      },
    ],
  },
  {
    id: "vm-4f55", role: "migrator", profile: "fde-migrator", label: "Keystone · documents", region: "us-west-2", vcpu: 2, memGb: 4, browser: true, parent: "vm-4d90",
    scripts: [
      {
        task: "T8",
        steps: [
          s("note", "sub-agent of vm-4d90 · shared browser session", 300),
          s("tool", "browser.open Tenants ▸ Documents", 900, { frame: { screen: "docs", url: `${KS}/tenants/documents.aspx`, focus: "rows" } }),
          s("tool", `download ${N.tenants} leases · 140 ID scans · 87 notes → /work/docs`, 1300, { frame: { screen: "docs", url: `${KS}/tenants/documents.aspx?page=12`, focus: "dl" } }),
          s("tool", `ocr.classify → lease ${N.tenants} · id 140 · note 87`, 900),
          s("ok", `${N.docs} documents · 212 MB · 5m 40s`, 300),
        ],
      },
    ],
  },
  {
    id: "vm-5a08", role: "integrator", profile: "fde-integrator", label: "Gate · payments · phones", region: "us-west-2", vcpu: 2, memGb: 4, browser: false,
    scripts: [
      {
        task: "T10",
        steps: [
          s("cmd", "codex exec --profile fde-integrator --task pdk-access", 200),
          s("tool", "email.send marcus@sierraaccess.com cc gail@brennanstorage.com", 700, { fire: "mail:dealer" }),
          s("note", "waiting on Sierra Access · nudge at 10:00 am if no reply · VM released", 400, { fire: "vendor:wait" }),
        ],
      },
      {
        task: "T9",
        steps: [
          s("tool", "processor.transfer keystone-pay → stripe · PCI secure file transfer", 800),
          s("out", `${N.autopay} cards → network tokens · no agent sees a card number`, 900),
          s("ok", `${N.autopay}/${N.autopay} tokens mapped to tenants`, 300),
        ],
      },
      {
        task: "T11",
        steps: [
          s("tool", "pdk.sites.get 4471 → Gate 1 · Gate 2 · Building D door", 700),
          s("tool", "pdk.groups.map gates → zonera access groups", 600),
          s("tool", `pdk.credentials.upsert ${N.tenants} codes from staging`, 1300),
          s("tool", "rule on move-out → pdk.credentials.revoke within 60s", 600),
          s("ok", "codes synced · double entry retired", 300),
        ],
      },
      {
        task: "T12",
        steps: [
          s("tool", "carrier.forward (530) 555-0142 → Zonera Voice · 18:00–09:00", 700),
          s("tool", "test call → answered in 0.8s · “Zonera Alder Lake, how can I help?”", 800),
          s("ok", "after-hours calls covered", 300),
        ],
      },
      {
        task: "T13",
        steps: [
          s("tool", "stripe.customers.create “Brennan Storage Co. LLC”", 600),
          s("tool", "stripe.subscriptions.create price=professional_999 · trial_end 2026-12-01", 700, { fire: "stripe" }),
          s("tool", "stripe.payouts → Sierra Pacific ••••0918 (verified)", 700),
          s("ok", "subscription trialing · payouts ready", 300),
        ],
      },
    ],
  },
  {
    id: "vm-6c3b", role: "validator", profile: "fde-validator", label: "Independent validator", region: "us-east-1", vcpu: 4, memGb: 8, browser: false,
    scripts: [
      {
        task: "T18",
        steps: [
          s("cmd", "codex exec --profile fde-validator --task reconcile", 200),
          s("note", "two-key rule: writer vm-4d90 · checker vm-6c3b (separate VM, separate role)", 500),
          s("ok", `tenants   ${N.tenants} = ${N.tenants}`, 700, { fire: "check:tenants:pass" }),
          s("warn", "units     D-209 10×15 in Keystone ≠ 10×10 on 2014 site plan", 800, { fire: "check:units:flag|exc:size" }),
          s("note", "texting Priya at 8:00 am, when the office opens · checks continue", 900),
          s("warn", `balances  ${money(N.balance - 35)} ≠ ${money(N.balance)} · Δ $35.00`, 900, { fire: "check:balances:flag" }),
          s("tool", "ledger.diff → late fee posted 6:02 pm, after the export", 800),
          s("tool", "browser re-pull A-131 ledger → match", 800),
          s("ok", `balances  ${money(N.balance)} = ${money(N.balance)} · fixed with evidence`, 600, { fire: "check:balances:fixed" }),
          s("ok", `ledger    ${N.ledger.toLocaleString()} = ${N.ledger.toLocaleString()} lines`, 600, { fire: "check:ledger:pass" }),
          s("ok", `units     ${N.units} = ${N.units} · D-209 corrected to 10×10 by Priya`, 600, { fire: "check:units:fixed", until: "size" }),
          s("warn", "people    “Matt Okafor” (C-114, closed) ≈ “Matthew Okafor” (A-122)", 800, { fire: "check:people:flag|exc:dup" }),
          s("note", "escalated to Jordan Lee · recommendation: merge, keep history", 600, { until: "dup" }),
          s("ok", "people    merged · 2023 history kept · decision by Jordan Lee", 600, { fire: "check:people:fixed" }),
          s("ok", `documents ${N.docs} = ${N.docs}`, 600, { fire: "check:docs:pass" }),
          s("ok", `protection plans ${N.protection} = ${N.protection}`, 600, { fire: "check:protection:pass" }),
          s("ok", "reconciliation signed · report.pdf", 300),
        ],
      },
      {
        task: "T19",
        steps: [
          s("tool", `pdk.credentials.list → ${N.tenants} · compare to staging`, 800),
          s("ok", `gate codes ${N.tenants} = ${N.tenants}`, 600, { fire: "check:gate:pass" }),
          s("tool", "test revoke + restore on a vacant unit → 0.9s", 700),
          s("ok", "move-out revocation works", 300),
        ],
      },
      {
        task: "T20",
        steps: [
          s("tool", `stripe $0 auth × ${N.autopay}`, 900),
          s("ok", `autopay ${N.autopay} = ${N.autopay} approved · 2 cards expire before Nov → collections agent`, 600, { fire: "check:autopay:pass" }),
        ],
      },
    ],
  },
];

export const VM_BY_ID = new Map(VMS.map(v => [v.id, v]));

export const CHECKS: Check[] = [
  { id: "tenants", label: "Tenants", source: "Keystone rent roll", target: "staging.tenants", status: "pending" },
  { id: "units", label: "Units", source: "Keystone + 2014 site plan", target: "staging.units", status: "pending" },
  { id: "balances", label: "Open balances", source: "Keystone ledgers", target: "staging.ledger", status: "pending" },
  { id: "ledger", label: "Ledger lines", source: "Keystone ledgers", target: "staging.ledger", status: "pending" },
  { id: "people", label: "People", source: "Keystone tenants", target: "staging.people", status: "pending" },
  { id: "docs", label: "Documents", source: "Keystone documents", target: "staging.documents", status: "pending" },
  { id: "protection", label: "Protection plans", source: "Keystone", target: "staging.protection", status: "pending" },
  { id: "gate", label: "Gate codes", source: "staging", target: "PDK site 4471", status: "pending" },
  { id: "autopay", label: "Autopay", source: "Keystone Pay", target: "Stripe tokens", status: "pending" },
];
