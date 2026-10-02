# Zonera HQ and the Automated FDE

> **One SDR. A thousand facilities. No second touch.**
>
> Signing up for Zonera should feel like signing up for Gmail, even when the facility is leaving
> 15 years of legacy software, a gate controller and a paper lease behind.

PLAN.md is the first wedge of the investor story: an agent-native facility you run by talking to it.
This file is the second wedge, **how a facility gets onto Zonera**. When a sales call ends, a fleet of
coding agents running in isolated VMs does everything a forward-deployed engineer (FDE) and an
implementation team would do:

- read the call and work out what this customer needs
- generate the owner's onboarding, asking only for what agents can't get themselves
- log into the legacy system and move the data
- chase the gate dealer for API keys
- validate every tenant, unit and cent
- cut over before the gate opens

The demo is the chassis: data is hard-coded and the timeline is scripted, but every screen is
interactive. Every number matches the operator demo's facility (Alder Lake: 181 units,
161 tenants, 106 on autopay).

---

## 1. Why this wins

Self-storage software is sticky because switching is painful, not because it's good. Storify (our
earlier product) shows what onboarding costs today:

- an 8-state machine walked by hand: `DRAFT → DETAILS_COMPLETE → PLAN_CONFIGURED → CONTRACT_GENERATED → AWAITING_SIGNING → AWAITING_PAYMENT → ONBOARDING_IN_PROGRESS → ACTIVE`
- a fixed 7-item requirement template (customer export, unit export, facility map, billing policy
  inputs, branding, signer, go-live config)
- a hiring plan for forward-deployment engineers who run discovery, migration scripts and
  reconciliation for each facility

| Today (incumbents, and Storify v1)                         | Zonera                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| 4–8 weeks from signature to go-live                        | ~36 hours, most of it waiting on a gate dealer and the night |
| An implementation person per account                       | 1 SDR supervises ~1,000 facilities                           |
| A fixed template of exports and forms                      | A checklist generated from the call: 11 items, ~9 minutes    |
| The owner exports reports from the old system             | A browser agent logs in and pulls them                       |
| The owner chases the gate dealer for API keys              | An agent emails the dealer, nudges, and validates the key    |
| Errors found by tenants after go-live                      | An independent validator reconciles everything before cutover |

When onboarding costs nothing, we can take the long tail: 50k+ independent facilities that can't
justify a six-week implementation today. **The metric that matters is human touches per facility
onboarded**, and it is on every HQ screen. The portfolio average is 0.5. Alder Lake's is 1.

---

## 2. Who sees what

| Surface | Route | Who | Job |
| --- | --- | --- | --- |
| **Zonera HQ** (super admin) | `#admin-…` | Zonera staff: the one SDR, ops, finance | Run the portfolio, watch the fleet, decide only what agents escalate |
| **Owner onboarding portal** (customer side) | `#onboard-…` | The facility owner and their manager | Hand over only what we can't get ourselves, sign, pay, watch setup happen, go live |
| **Operator console** (PLAN.md) | `#ops-…` | The facility after go-live | Run the facility by talking to it |

Both HQ and the portal render from the same onboarding object (`src/admin/fde/engine.ts`), so an
action on either side shows up on the other immediately.

---

## 3. The story we film: Brennan Storage Co.

- **Customer.** Gail Brennan owns three facilities: Alder Lake (181 units, the operator demo's
  facility), Dolores (184) and Pier 7 (96). Priya Raman manages Alder Lake.
- **Legacy stack.** Keystone Storage Manager 8.4 since 2012, a PDK gate installed by Sierra Access
  & Security (Marcus Webb), and payouts to Sierra Pacific Credit Union.
- **Deal.** Professional plan, $999/mo for up to 5 facilities, 60 days free, 12-month term, price
  locked for 24 months.
- **Two calls and one email.** Discovery (Sep 24, 27 min); walkthrough and terms (Sep 30, 41 min,
  with Priya); Gail's follow-up email the next morning ("we're a U-Haul dealer at the front desk").

**Timeline (story clock).** The call ends Wed 6:12 pm. The portal reaches Gail at 6:19 pm, and she
finishes her part at about 9 pm. Overnight, agents migrate. Thursday brings the follow-up email, a
text to Priya, Jordan's one decision and Marcus's API key. Cutover is **Fri 5:45 am, 15 minutes
before the gate opens**: 35 h 33 m from call to live, with 1 human touch. The operator demo picks
up at 9:44 am the same day, Alder Lake's first morning on Zonera.

### Requirements the analyst extracts (each cites the line it came from)

| Id | Requirement | Cited from |
| --- | --- | --- |
| R1 | Move everything out of Keystone 8.4 | call 1 01:09, 12:05 |
| R2 | One gate code system (PDK sync, revoke on move-out) | call 1 02:48, call 2 00:27 |
| R3 | Late-payment playbook: text d1, $25 fee d6, overlock d10 | call 1 04:21, call 2 09:31 |
| R4 | Attorney's lease word for word; CA lien timeline (notice d14) | call 1 14:22, call 2 09:31 |
| R5 | Hold existing rates 6 months | call 2 05:44 |
| R6 | Rent online | call 1 08:30 |
| R7 | Answer calls after 6 pm | call 1 06:06 |
| R8 | 106 autopays keep working | call 1 11:18 |
| R9 | Live before the Oct 5 autopay run | call 2 34:02 |
| R10 | Payouts to Sierra Pacific | call 2 13:05 |
| R11 | Manager login without financials | call 2 16:40 |
| R12 | Join the Zonera network brand ("Zonera Alder Lake") | call 2 21:18 |
| R13 | Professional · 60 days free · 12 mo · locked 24 mo | call 2 27:02, 27:26 |
| R14 | Truck rentals at the front desk (*arrives mid-onboarding*) | email 07:52 |

---

## 4. Dynamic onboarding: generated, not a template

The architect agent compiles requirements against Zonera's capability catalog and emits two
artifacts:

- an **internal plan**: 22 tasks across 8 VMs, each with an owner and dependencies
- the **owner checklist**: a schema that asks Gail only for what agents can't get themselves

| Item kind | Owner sees | Brennan example |
| --- | --- | --- |
| `credential` | Share a login once: vaulted, read-only, revoked at cutover | Keystone login (replaces three exports) |
| `delegate` | "Tell us who to ask, we'll chase them" | Ask Marcus at Sierra Access for PDK access |
| `upload` | Drop zone that parses on arrival | Lease, March revision (lien notice found on p. 9) |
| `confirm` | Yes to something we heard | Late-payment playbook; after-hours calls; truck rentals |
| `choice` | Options with the call's answer preselected | Rate hold 6 / 12 months; storefront name |
| `form` | Only fields we couldn't find, prefilled | Payout account *found in Keystone settings* by the migrator |
| `sign` | MSA generated from the negotiated terms | Terms highlighted, each citing the call |
| `pay` | Subscription start | Test card, nothing charged until Dec 1 |

Every item carries **why** (a quote from the call), **what it unblocks**, and a **way out** ("Prefer
not to share a login? Upload exports instead").

When new context arrives, the analyst re-reads it and the checklist recompiles in place. On
camera, Gail's 7:52 am email adds R14, a new owner item (O12) and a new task (T22), and both
screens update without a new email.

---

## 5. The fleet: agents in VMs

**What we'd build:**

- The **orchestrator** (Zonera control plane) turns the plan into jobs. It schedules each job
  onto an isolated **microVM** (Firecracker-class) and releases the VM while waiting on a vendor.
- Each VM boots a **Codex harness** pinned to a role profile: `fde-analyst`, `fde-architect`,
  `fde-builder`, `fde-migrator`, `fde-integrator` or `fde-validator`.
- **Tools:** `shell`, `fs` (scoped to `/work`), `psql` (a per-facility database role), `http`
  (egress allow-list), `browser` and `computer` (sandboxed Chromium with computer use, for legacy
  web apps), `vault.lease`, `email`/`sms`, and `escalate`.
- **Sub-agents.** The migrator forks one browser agent each for ledgers and documents, and they
  share the vaulted session.
- **Recording.** Every session (terminal, browser frames, tool calls) is recorded and signed, then
  attached to the onboarding's audit log.

**Access policy, enforced outside the model:**

```yaml
role: fde-migrator@brennan
database:
  read:  [legacy_import.brennan.*]
  write: [staging.alder_lake.*]
  prod:  deny              # promotion only via validator + approval
secrets:
  - keystone/brennan       # read · ttl 4h · revoked when the job ends
egress: [brennan.keystonesm.net]
sandbox: chromium · downloads only to /work · no clipboard
pii: card numbers never    # autopay moves as network tokens
audit: full recording · every tool call signed
```

**Guardrails we say out loud:**

- **Two-key rule.** The agent that writes data never validates it.
- **Staging-first.** Agents can't write production; promotion is a gated, audited event.
- **Least privilege.** A job gets only the secrets, tables and hosts it needs, for as long as it needs them.
- **Humans handle exceptions, not workflows.** Escalations go to the right human. D-209's size
  question went to Priya by text (she's on site). The duplicate-tenant merge went to Jordan.

---

## 6. Billing: fully SaaS

- The **MSA** is generated from the deal's terms, with variable terms highlighted and cited to the
  call. Gail signs with a typed e-signature.
- The **subscription** goes through Stripe: customer, Professional price, trial ending Dec 1, card
  on file. The demo stays in test mode with no real card form.
- **Payouts** for tenant rent go through Stripe to the account the migrator found in Keystone.
- **HQ** shows plan, MRR and trial status per facility.

---

## 7. Screens

**Zonera HQ (`src/admin`, prefix `sa-`)**

| Route | Screen |
| --- | --- |
| `#admin-overview` | **Mission control.** 1 SDR · 1,042 facilities, ARR, median call→live, touches per facility, fleet size, US map, pipeline by stage, go-lives per week, "migrated from" (the incumbents we take share from), live activity |
| `#admin-onboarding` | **Onboarding board.** 63 onboardings by stage; Brennan is live |
| `#admin-onboard-brennan` | **Workspace** (hero screen). Left: the transcript, with lines highlighting as the analyst reads them. Center: requirements, checklist, plan, validation, mail, activity; follows the stage automatically. Right: the focused VM's terminal or browser plus the fleet |
| `#admin-vm-<id>` | **VM session.** Browser stream of the agent driving Keystone, terminal, the VM's policy, vault lease, tool calls and recording |
| `#admin-fleet` | **Agent fleet.** Every VM across all onboardings |
| `#admin-queue` | **Needs you.** The only decisions people make, each with evidence and a recommendation |
| `#admin-facilities` | **Facilities.** All 1,042, with plan, MRR, legacy source, touches and hours to live |
| `#admin-policies` | **Policies & vault.** Role templates, active leases, audit log |

**Owner portal (`src/admin/onboard`, prefix `ob-`)**

| Route | Screen |
| --- | --- |
| `#onboard` | **Sign up.** Email + facility address; we find the facility and show what we already know |
| `#onboard-home` | **Your setup.** "Needs you" plus quick confirms, each citing the call; a live feed of what we're doing for you |
| `#onboard-msa` | **Agreement.** The generated MSA with highlighted, cited terms; typed signature |
| `#onboard-billing` | **Plan & payment.** Test-mode card, nothing charged until Dec 1 |
| `#onboard-live` | **You're live.** What moved, what was verified; open the console |

---

## 8. Running the demo

The presenter dock (bottom right on HQ and the portal) has **Start**, speed (1×/2×/4×/8×),
**Autopilot** (Gail and Jordan act on their own, for hands-free filming) and **Reset**. Press `.`
to hide it together with the demo bar. Movie mode turns autopilot on too. A full run takes about
70 seconds at 1× with autopilot.

**Suggested take (~4 min):**

1. **Mission control.** "This is our whole implementation team: one person."
2. **Brennan's call just ended.** Open the workspace and press Start. The transcript scrolls,
   requirements appear with citations, and the architect compiles the checklist.
3. **View as Gail.** Eleven items, about 9 minutes. Share the Keystone login.
4. **Back in HQ.** A browser agent signs into Keystone and pulls the rent roll; sub-agents take
   ledgers and documents. The migrator finds the payout account, and Gail's payout item turns into
   a one-click confirm.
5. **New context.** Gail's 7:52 am email lands. R14 appears, then a new item on her checklist.
6. **Validate.** D-209's size goes to Priya by text and comes back fixed. A $35 balance difference
   is fixed with evidence. One duplicate tenant goes to Jordan, who merges it: human touch #1.
7. **Marcus replies.** 161 gate codes sync to PDK and are read back.
8. **Cutover at 5:45 am.** Live in 35 h 33 m. Open the Alder Lake console, its first morning on Zonera.

## 9. Real vs simulated

| Real in the demo | Simulated |
| --- | --- |
| Every route, screen and interaction | VMs, Codex runs, terminals, browser frames |
| One shared state between HQ and the owner portal | Stripe, e-signature, email/SMS, PDK API |
| Facility numbers that match the operator console | Transcripts, extraction, plan compilation (scripted) |
| A dependency graph: owner actions really unblock agent work | Story clock (compressed 36 h) |

Code: `src/admin/fde/` (types, data, engine, widgets), `src/admin/hq/` (HQ pages),
`src/admin/onboard/` (owner portal), `src/styles/admin*.css`, `src/styles/onboard.css`.
