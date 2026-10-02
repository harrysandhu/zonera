# Zonera agent — action & widget catalog

The operator never learns screens. They say what they want; the agent fills in what it can, asks for what it can't, and shows a widget only where a person should look or decide. This file is the spec for every action the agent demo supports, and the widget each one uses.

- **Actions:** 76, in 10 categories.
- **Widgets:** 42 types, all generic and data-driven.
- **Permutations:** every action is a *parametric skill*. Its slots come from the prompt, so one skill answers many phrasings and combinations. The matrix at the end counts more than 2,000 distinct, valid flows.

---

## 1. The interaction model

### Turn anatomy
1. **User message:** typed, voice, from ⌘K, or a one-click "Do it" from any dashboard.
2. **Understanding line:** a one-line restatement with the slots filled, in mono chips. Example: `email` · `4 people` · `rent reminder` · `send now`. Each chip is editable inline. Click `email` to switch it to `sms`.
3. **Thinking:** collapsible, with elapsed time.
4. **Tool calls:** rows like `tenants.search({ name: "Matthew" })` → `3 matches · 182 ms`, expandable to show args and result JSON.
5. **Agent text:** streamed, short, numbers first.
6. **Widget:** zero or one per turn, the decision point.
7. **Effect + receipt:** what changed, with deep links ("Open profile", "View in twin") and an **Undo** where the domain allows it.
8. **Next chips:** 2–3 suggested follow-ups ("Text the receipt", "Set up autopay", "Remove late fee policy for him").

### Slot filling: where the back-and-forth comes from
| Slot state | What the agent does |
|---|---|
| Filled with confidence | Uses it and shows it as a chip |
| Ambiguous (3 Matthews) | **Disambiguation** widget |
| Missing, with a sensible default | Uses the default, marks the chip *default*, still editable |
| Missing, no default | Asks one question with **quick-reply chips**, never a blank form |
| Conflicting (no email on file) | Warns inline and proposes a fix ("Text Owen instead?") |

### Widget lifecycle
`proposed → editing → confirmed → executing → done` (or `failed → retry`). After confirmation, a widget collapses into a one-line **read-only summary** with a "Show details" toggle, so the transcript stays clean. Every widget can be answered by keyboard. In movie mode, the scripted choice is pressed after a readable pause.

### Permission tiers
Every tool has a tier from Settings → Agent permissions:
- **Auto:** runs immediately and shows a receipt.
- **Ask first:** the widget's primary button reads "Approve and run".
- **Never:** the agent explains why and offers to hand the task to a person.

Money, access, and legal actions default to *Ask first*.

---

## 2. Widget library

Each widget is one file in `src/agent/widgets/`, registered in `registry.ts`, generic over its data.

| # | Widget | Looks like | Used by |
|---|---|---|---|
| W1 | **QuickReplies** | Agent question + 2–5 chips + "Something else…" | Any missing slot |
| W2 | **Disambiguate** | Candidate rows (avatar, name, unit, balance, status), "Likely" tag on the best match, single select | Names, units, transactions |
| W3 | **RecipientSet** | Chips for people, rows for segments ("Past due · 12"), search to add, × to remove, per-person channel status (no email, opted out of SMS), live count | All messaging |
| W4 | **BulkMessageComposer** | Channel tabs (SMS / Email); template with merge fields `{first}` `{unit}` `{balance}` `{due_date}`; tone switch (Friendly · Firm · Brief); SMS segment counter; email subject; per-recipient preview pager "2 of 4"; schedule (Now · 9:00 am tomorrow · Custom); button "Send 4 texts" | Bulk SMS, bulk email, announcements, lead follow-ups |
| W5 | **DeliveryTracker** | Per-recipient row: queued → sent → delivered → read / replied, replies inline | After any send |
| W6 | **EmailDraft** | Single email: to, subject, body editor, attachments (receipt.pdf), send | One-off emails, letters |
| W7 | **ThreadPreview** | Message thread with the new message appended | Replies, inbox triage |
| W8 | **ReportBuilder** | Report type, period, compare to, sections (toggles), format (PDF / CSV / link), recipients, schedule | All reports |
| W9 | **ReportPreview** | Mini document: KPI tiles, 2–3 charts, agent-written narrative, page count; actions: Send, Download, Schedule monthly | All reports |
| W10 | **AnswerCard** | One big number + context line + mini list ("4 available 10×10s · A-126, C-107, C-109, C-117") | Q&A |
| W11 | **ChartCard** | One chart that answers the question, with "Add to report" and "Break down by…" chips | Ad-hoc analysis |
| W12 | **DataTable** | Sortable, selectable rows, sticky bulk-action bar ("4 selected · Text · Email · Apply fee") | Lists, sweeps |
| W13 | **Ledger** | Charges, payments, fees with running balance; the lines being paid are highlighted | Payments, refunds, disputes |
| W14 | **PaymentForm** | Amount (prefilled), method (Cash · Card on file · New card · ACH · Check), apply-to allocation, receipt by SMS/email | Take payment |
| W15 | **Receipt** | Paid, new balance, unlocks triggered, receipt sent to…, Undo (5 min) | Any money movement |
| W16 | **RefundForm** | Pick the transaction(s), full or partial, reason, destination | Refunds |
| W17 | **CreditWaive** | Fee lines with checkboxes, reason, impact on balance | Waive fees, credits |
| W18 | **PaymentPlan** | Split balance into N installments, dates, autopay toggle, signed agreement | Delinquency hardship |
| W19 | **UnitPicker3D** | Mini twin with candidate doors lit + list (id, size, floor, price, distance from gate); compare up to 3 | Move-ins, transfers, reservations |
| W20 | **UnitCompare** | 2–3 units side by side: size, price, location, features, price delta | Transfers, upsells |
| W21 | **Proration** | Line-by-line math, editable dates, totals today / next month | Move-in, transfer, move-out |
| W22 | **PersonForm** | Prefilled fields (from lead / ID scan) with validation | New tenants, contact changes |
| W23 | **IdScan** | Licence capture → extracted fields with confidence | Walk-ins |
| W24 | **ProtectionPicker** | Tiers + own-policy upload | Move-ins |
| W25 | **EsignTracker** | Document preview + signer + live status (sent → opened → signed), resend | Leases, addenda, payment plans |
| W26 | **GateCodeBuilder** | Who (tenant / vendor / staff); zones as toggles on a mini map (Gate 1, Gate 2, Building D doors, elevator); time window on a 24 h strip; one-time / recurring days; big mono code; deliver via SMS | Gate access |
| W27 | **AccessToggle** | Lock / unlock, with reason, overlock work order, tenant notification | Lockouts |
| W28 | **EventLog** | Filterable gate events with time, code, person, door, camera link | Investigations |
| W29 | **PlanChecklist** | Proposed actions grouped by type, each with a toggle and a permission badge, impact summary, "Approve and run 9 actions" | Sweeps, clear my day, batch work |
| W30 | **ProgressList** | Live execution, per-item status, retry failed, "View all changes" | After any plan |
| W31 | **BatchCards** | One card per entity running in parallel (lease → signed → paid → code) | Batch move-ins, bulk notices |
| W32 | **Timeline** | Dated steps with documents (legal or lifecycle) | Lien, move-out |
| W33 | **SlotPicker** | Day strip + time slots + attendee | Tours, inspections, vendors |
| W34 | **ImpactSimulator** | Slider (rate %, promo length) → projected revenue, churn, occupancy (chart) | ECRI, street rates, promos |
| W35 | **PromoBuilder** | Offer, eligible sizes, conditions, end rule ("until 90% occupied"), storefront badge preview | Promos |
| W36 | **WorkOrder** | Issue, unit/asset, photo, priority, vendor, slot, notify tenant | Maintenance |
| W37 | **ImportMapper** | File chips → column mapping → validation errors → discrepancy resolver | Facility setup, migrations |
| W38 | **TwinBuild** | 3D model rising from the site plan, with counts | Facility setup |
| W39 | **Diff** | Before / after for record changes, approve | Rate changes, contact changes, settings |
| W40 | **DayPlan** | Today's tasks with owner (Me / Agent / Staff), drag to reschedule | Clear my day, briefings |
| W41 | **DangerConfirm** | Type the unit id to confirm; legal note | Lien sale, write-off |
| W42 | **CallHandoff** | Call card with live status, opens the call panel | Voice calls |

---

## 3. Action catalog

Each entry lists the *slots*, the *example prompts* that must all work, and the *flow* as widgets.

### A. Front desk
| # | Action | Example prompts | Slots | Flow |
|---|---|---|---|---|
| 1 | Walk-in move-in | "New customer wants a 10×10 today, Jordan Lee" · "Rent a 5×10 to the guy at the counter" | person, size, date, protection, plan | W23 → W22 → W19 → W24 → W21 → W25 → W26 → W15 |
| 2 | Move-in a reservation | "Move Owen Murphy in" | lead | W2 (if needed) → W19 (prefilled) → W21 → W25 → W15 |
| 3 | **Batch move-ins** | "Move these three reservations in today: Owen, Hana, Imani" · "Move in everyone reserved for this week" | leads[] / segment, date | W3 → W29 → W31 |
| 4 | Reserve for a caller | "Hold a 10×20 for Rafael until Monday" | person, size, hold-until | W19 → W22 → W15 (hold receipt) |
| 5 | Cancel reservation | "Cancel Wes Abbott's reservation, he found a closer place" | lead, reason | W1 (reason) → W39 |
| 6 | Schedule move-out | "Ben Carter is moving out Friday" | tenant, date | W21 → W33 (inspection) → W32 → W15 (refund of prepaid) |
| 7 | Complete move-out | "Ben's unit is empty, close it out" | tenant/unit | W29 (release lock, deactivate code, clean, re-list) → W30 |
| 8 | Transfer / upsize / downsize | "Sofia wants a bigger unit" · "Move Sofia from C-108 to C-117" | tenant, target size/unit | W20 → W21 → W25 (addendum) → W26 (code reassigned) |
| 9 | Add a second unit | "Matthew Cho needs another 5×5" | tenant, size | W19 → W21 → W25 |
| 10 | Update contact info | "Grace has a new number, 530-555-0110" | tenant, field, value | W39 |
| 11 | Add authorized user | "Let Dana's brother access A-131" | tenant, person, units | W22 → W26 → W39 |
| 12 | Book a tour | "Book Leila a tour tomorrow afternoon" | person, date window | W33 → W6/W4 (confirmation) |

### B. Money
| # | Action | Example prompts | Slots | Flow |
|---|---|---|---|---|
| 13 | **Take a payment** | "Matthew paid $240 cash" · "Okafor dropped off a check for 195" · "Charge Grace's card for her balance" | tenant, amount, method | W2 → W13 → W14 → W15 (+ auto unlock) |
| 14 | Charge card on file | "Run Ben's card for November" | tenant, amount/period | W14 (card on file) → W15 |
| 15 | Refund | "Refund Matthew Alvarez's duplicate charge" · "Refund half of Ben's prepaid" | tenant, txn, amount | W13 → W16 → W15 |
| 16 | Waive / credit | "Waive Sofia's late fee, our gate was broken" | tenant, fee, reason | W17 → W15 |
| 17 | Apply late fees | "Apply late fees per policy" | policy, segment | W12 → W29 → W30 |
| 18 | Autopay setup / card update | "Send Grace a link to update her card" | tenant(s), channel | W4 → W5 |
| 19 | Fix autopay failures | "Fix last night's autopay failures" | date | W12 → W4 → W5 |
| 20 | Prepay quote | "What would 12 months prepaid cost Hana?" | person, months | W10 + W21 |
| 21 | Payment plan | "Set Dana up on a payment plan, 3 months" | tenant, installments | W13 → W18 → W25 |
| 22 | Write off bad debt | "Write off the balance on A-140" | tenant/unit | W13 → W41 |
| 23 | End-of-day close | "Close out today" | date | W12 (deposits) → W10 (variance) → W15 |
| 24 | Send statements | "Email statements to everyone with a balance" | segment, channel | W3 → W4 → W5 |

### C. Collections & legal
| # | Action | Example prompts | Slots | Flow |
|---|---|---|---|---|
| 25 | **Delinquency sweep** | "Who's more than 15 days late?" · "Handle collections" | threshold | W12 → W29 → W30 |
| 26 | Overlock / remove | "Overlock everyone 30+ days late" · "Take the lock off A-122" | units/segment | W12 → W27 → W30 |
| 27 | Pre-lien notices | "Send pre-lien notices that are due" | segment | W12 → W32 → W29 |
| 28 | Lien sale scheduling | "Start the lien process for Dana" | tenant | W32 → W41 → W30 |
| 29 | Post auction results | "A-131 sold for $410" | unit, amount | W21 (proceeds vs balance) → W39 |
| 30 | Hardship hold | "Pause collections for Grace for two weeks" | tenant, duration, reason | W39 |

### D. Access & security
| # | Action | Example prompts | Slots | Flow |
|---|---|---|---|---|
| 31 | **New gate code** | "Gate code for the HVAC tech, 1–5pm today, Building D only" · "Give the cleaners access every Tuesday 6–8am" | who, zones, window, recurrence | W26 → W4 (deliver) → W15 |
| 32 | Reset tenant code | "Reset Matthew Alvarez's gate code" | tenant | W39 → W4 |
| 33 | Lock out / restore | "Lock out D-118" · "Restore Grace's access" | unit/tenant | W27 |
| 34 | Temporary user access | "Let Sofia's mover in Saturday morning" | person, window | W26 |
| 35 | Gate hours | "Close the gate at 6pm on Thanksgiving" | date, hours | W39 → W4 (announce) |
| 36 | Investigate events | "Who came in after 10pm last night?" | window, zone | W28 → W11 |
| 37 | Bulk lockout | "Lock out everyone overlocked in Building A" | segment | W12 → W29 → W30 |

### E. Facility & maintenance
| # | Action | Example prompts | Slots | Flow |
|---|---|---|---|---|
| 38 | Work order | "Door on C-112 is jammed" | unit/asset, issue | W36 → W33 → W15 |
| 39 | Vendor visit | "Schedule the pest guy next week, he needs gate access" | vendor, window | W33 → W26 |
| 40 | Mark unit status | "A-140 is cleaned, put it back on the site" | unit, status | W39 |
| 41 | Vacant unit walkthrough | "Make me a walkthrough list for vacant units" | segment | W12 → W40 |
| 42 | Facility setup | "Here's our site plan and rent roll" | files | W37 → W38 → W29 |
| 43 | Fix unit attributes | "C-117 is actually climate controlled" | unit, attribute | W39 |
| 44 | Lock check | "Schedule lock checks for Building B" | building | W33 → W40 |
| 45 | Compliance inspection | "When's the fire inspection due?" | — | W10 → W33 |

### F. Growth & pricing
| # | Action | Example prompts | Slots | Flow |
|---|---|---|---|---|
| 46 | **Rate review (ECRI)** | "Raise 10×10 tenants 8% if they've been here a year" | size, tenure, % | W12 → W34 → W29 → W4 (notices) |
| 47 | Street rate change | "Drop 10×20 street rate to $299" | size, price | W34 → W39 |
| 48 | Promo | "$1 first month on 10×20s until we hit 90%" | offer, sizes, end rule | W35 → W39 (publish) |
| 49 | Lead follow-up | "Follow up with this week's reservations" | segment, channel | W3 → W4 → W5 |
| 50 | Call a person | "Call Leila and finish her reservation" | person, purpose | W42 |
| 51 | Abandoned checkout recovery | "Who abandoned checkout this week?" | window | W12 → W4 |
| 52 | Review requests | "Ask last month's move-ins for a Google review" | segment | W3 → W4 → W5 |
| 53 | Competitor check | "How do our 10×10s compare to Lakeside Self Storage?" | size, competitor | W11 → W10 |

### G. Communications
| # | Action | Example prompts | Slots | Flow |
|---|---|---|---|---|
| 54 | **Send emails to people** | "Send an email to Owen, Hana, Imani and Rafael about move-in times" | people[], topic | W3 → W4 (email) → W5 |
| 55 | **Send SMS to people** | "Text these 4 people their gate codes" · "Text everyone past due" | people[] / segment, template | W3 → W4 (SMS) → W5 |
| 56 | Announcement | "Tell all tenants the gate is closed Saturday 8–10am" | audience, message, channel | W3 (all tenants · 161) → W4 → W5 |
| 57 | Inbox triage | "What's in the inbox?" · "Reply to everyone asking about hours" | — | W12 → W7 (drafts) → W5 |
| 58 | Recurring reminders | "Text rent reminders 3 days before due" | cadence, segment | W39 (automation) |
| 59 | Letter by mail | "Mail Dana a notice to vacate" | tenant, template | W6 → W41 |

### H. Reports & insights
| # | Action | Example prompts | Slots | Flow |
|---|---|---|---|---|
| 60 | **Owner report** | "Generate the September owner report vs last year" | period, compare | W8 → W9 → W4 (email owners) |
| 61 | Occupancy report | "Occupancy by size for Q3" | period, group | W11 → W9 |
| 62 | Aging report | "Delinquency aging as of today" | date | W11 → W12 |
| 63 | Collections report | "How much did we collect this week?" | period | W10 → W11 |
| 64 | Move-in sources | "Where did September's move-ins come from?" | period | W11 |
| 65 | Ad-hoc Q&A | "How many 10×10s are free?" · "Did the 10×20 promo work?" | metric, filter | W10 / W11 |
| 66 | Export | "Export tenants with autopay off to CSV" | filter, format | W12 → W15 (file) |
| 67 | Scheduled report | "Send me occupancy every Monday" | report, cadence | W8 → W39 |

### I. Day & team
| # | Action | Example prompts | Slots | Flow |
|---|---|---|---|---|
| 68 | Morning briefing | "What needs my attention today?" | — | W10 cards → W40 |
| 69 | **Clear my day** | "I don't want to do the walkthroughs or the auction prep today" | tasks[] | W40 → W29 → W30 |
| 70 | Assign to staff | "Have Luis handle the C-112 door" | person, task | W39 → W4 |
| 71 | End-of-day summary | "Wrap up the day" | — | W9 (one page) |
| 72 | While I was out | "What happened while I was at lunch?" | window | W12 (events) |

### J. Admin & trust
| # | Action | Example prompts | Slots | Flow |
|---|---|---|---|---|
| 73 | Change agent permissions | "Don't text tenants after 8pm" · "Ask me before any refund over $100" | rule | W39 |
| 74 | Add staff | "Add Luis as maintenance with gate access" | person, role | W22 → W39 |
| 75 | Late-fee policy | "Make late fees $35 after 7 days" | fee, grace | W34 (impact) → W39 |
| 76 | Audit lookup | "What did you do for Matthew this week?" | entity, window | W12 (action log with undo) |

---

## 4. Permutation matrix

The parser fills these slots, so variety is real rather than scripted:

| Skill | Slot dimensions | Valid combinations |
|---|---|---|
| Messaging (54, 55, 56, 49, 52, 24, 18) | channel (SMS, email, both) × audience (named 1–6 people, past due, overlocked, autopay off, 10×10/10×20/… tenants, this week's leads, last month's move-ins, all tenants: 12+) × template (reminder, promo, notice, gate code, review ask, custom: 6) × timing (now, tomorrow 9 am, custom: 3) | 3 × 12 × 6 × 3 = **648** |
| Reports (60–67) | type (8) × period (today, week, month, quarter, YTD: 5) × compare (none, prior period, last year: 3) × format (PDF, CSV, link: 3) | **360** |
| Payments (13–16) | tenant (any of 161) × method (5) × amount (exact, balance, partial) × outcome (unlock, no unlock) | **4,800** (shown with story tenants) |
| Gate access (31–34) | who (tenant, vendor, staff, authorized user: 4) × zones (5 toggles) × window (once, today, recurring: 3) × delivery (SMS, email, print: 3) | **~1,100** |
| Units (1–9) | size (7) × climate (2) × date (4) × protection (4) | **224** |
| Pricing (46–48) | size (7) × % or $ (3 bands) × eligibility (3) | **63** |

---

## 5. Implementation notes for builders

- **Skill file:** `src/agent/skills/<category>/<action>.ts` exports `{ id, title, category, examples[], slots, match(prompt) → score + slots, run(ctx) }`. `run` uses the step DSL from `AUTHORING.md`.
- **Parser helpers:** names (TENANTS, LEADS), unit ids (`A-126`), sizes (`10x10`, `10 by 10`), money (`$240`, `240 dollars`), dates (`today`, `Friday`, `Oct 12`), times (`1–5pm`), counts (`these 4`), segments (keywords → filters), channels (`text`, `SMS`, `email`).
- **Every effect mutates `src/data` and calls `commit()`**, so dashboards, profiles, and the twin update live. Show a receipt with deep links.
- **Each action needs:** at least 2 example prompts that work, a sensible default for every slot, one question at most when something is missing, and a "Next" chip row.
- **Movie mode:** every widget declares its scripted answer.
