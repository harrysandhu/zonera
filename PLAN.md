# Zonera — product plan

**Zonera is the first agent-native self-storage platform.** Every self-storage system on the market today (SiteLink, storEDGE, Easy Storage Solutions, Yardi Breeze, Tenant Inc.) is a database with forms on top. You learn its screens before you can run your facility. Zonera inverts that: the operator says what they want, and the agent does it, asking only for what it needs and showing a widget only when a human decision is required.

> **The rule we never break:** a new operator should be productive in their first five minutes without training. If a task needs a manual, we failed. Every plan, spec and PR is checked against this.

This repository is the **chassis of the car**: a fully designed, clickable demo with hard-coded data and scripted agent behavior. It is built to be filmed and shown to partners and investors. Engine (real Claude Agent SDK loop, real integrations) comes next; the shapes here are what the engine will drive.

## Surfaces

| Surface | Who | Job |
|---|---|---|
| **Storefront** | Renters | Find the right size from what you're storing, see your exact unit in 3D, rent it in a one-question-at-a-time checkout, and get a gate code plus an animated route from the gate to your door |
| **Operator dashboard** | Managers, owners | Every screen a facility needs (overview, digital twin, units, tenants, customer profile, lease, payments, delinquency, reservations, rates, gate, maintenance, reports, settings), designed to be looked at, not learned |
| **Agent mode** | Managers | Talk or type. The agent runs tools, shows widgets inline, asks clarifying questions, and executes. Multiple sessions in tabs. 20 scripted operations cover the full day |
| **Call center** | Managers, owners | AI voice agents answer and place calls. Watch live transcripts, see what the agent is doing, whisper to it, take over, or start an outbound call. Slides in from the right and pushes the page |
| **Brand** | Everyone | The painted lakeside identity: plates, palette, type, voice |

## Storefront

1. **Hero:** the painted plate, live wordmark, one input: *What are you storing?*
2. **Size finder:** presets (studio, one-bedroom, seasonal gear, house, business) or item counts → cubic feet × 1.25 for aisle space → recommended size with a fill meter. The 3D facility diorama lights up every available unit of that size.
3. **Sizes:** six painted unit cutaways (5×5 to 10×30) plus RV/boat parking, with live availability and price.
4. **Checkout** (split screen): left, the isometric facility flies to *your* unit (beam, ring, label); right, a typeform-style flow, one question per screen, Enter to continue: move-in date → how long → name → contact → protection plan → billing plan → ID check → payment → plain-language lease summary + e-signature.
5. **Access:** the gate code, a wallet pass, and a looping HUD film of the drive from the gate to the unit door (dark glass, cyan lines, the car, turn-by-turn callouts).

## Operator dashboard

Overview · Digital twin (3D status map, click any door) · Units · Tenants → **customer profile** (ledger, lease, gate log, communications incl. AI call summaries, notes, documents) · Leases → **lease page** (agreement, plain-language summary, signatures, audit trail, addenda) · Payments · Delinquency (aging + lien pipeline) · Reservations · Rates & promos · Gate access · Maintenance · Reports · Call center · Settings (incl. **agent permissions**: what the agent may do on its own, what it must ask first, what it may never do).

Actions taken anywhere (agent, call center, storefront) update every screen immediately through `src/state/store.ts`.

## Agent mode — the 20 operations

Each operation is a scripted session: user message → thinking → tool calls (`tenants.search`, `ledger.get`, `payments.record` …) → inline widgets → confirmation → results that change the data.

1. Morning briefing — *"What needs my attention today?"*
2. Take a payment — *"Matthew came in and paid $240 cash"* (which Matthew? → ledger → payment → overlock removed → receipt texted)
3. Walk-in move-in — new customer, unit picker on the 3D twin, ID scan, protection, lease, e-sign, gate code
4. **Batch move-ins** — *"Move these three reservations in today: Owen, Hana, Imani"*
5. Move-out — final bill, proration, inspection, access end date, re-list
6. Transfer / upsize — Sofia from a 5×10 to a 10×10, prorated, addendum signed
7. **New gate access** — *"Gate code for the HVAC tech, 1–5pm today, Building D only"*
8. Lock out / overlock and release
9. Delinquency sweep — who's late, proposed plan, approve, execute with live progress
10. Lien process — California Self-Service Storage Facility Act timeline, notices scheduled
11. Rate review (ECRI) — impact preview with a slider, notices scheduled with 30 days' notice
12. Promotion — *"$1 first month on 10×20s until we hit 90%"*, published to the storefront
13. **Generate a report** — *"September owner report vs last year"* → charts + PDF
14. Lead follow-up — personalised SMS drafts for six reservations, edit and send
15. Maintenance — jammed door, work order, vendor, tenant notified
16. Facility setup — upload a site plan + rent roll → the 3D twin builds itself, discrepancies flagged
17. Autopay failures — five declined cards, update links sent
18. **Clear my day** — *"I don't want to do the walkthroughs or the auction prep today"* → agent takes or delegates each task
19. Refund a duplicate charge
20. **Call a customer** — *"Call Leila and finish her reservation"* → hands off to the voice agent in the call center

## Call center

- Push-in panel from the right on every operator screen: live calls with waveforms, intent, sentiment, timers.
- Open a call: streaming transcript (caller and Zonera Voice), the tools the voice agent is running, and controls: listen, whisper, **take over**, end.
- Outbound: dial a customer or a campaign (payment reminders, lead follow-ups) run by voice agents.
- Full page: wall of live calls, today's metrics (answered, resolved by AI, bookings, handle time), recent calls with summaries, voice persona settings.

## Brand

Painted Japanese-animation landscape (gouache, lake, mountains, meadow) with a small, lovely self-storage facility in it. Wordmark **zonera** in a soft serif, ink on sky. Line: **Just ask.** Apricot/peach-coral is reserved for *your unit*: the door you're about to open. Prompt debate and generation log live in `brand/prompts/`.

## Engine (next)

- Agent loop: Claude Agent SDK, tools as MCP servers over the facility database, payments (Stripe), messaging (Twilio), gate controllers (PTI / OpenTech), e-sign.
- Permission tiers per tool (auto / ask first / never), every action written to an audit log with an undo where the domain allows it.
- Voice: real-time speech-to-speech with the same tools; human takeover over the same session.
