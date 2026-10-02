# Authoring agent skills and widgets

Agent mode runs **skills**: parametric scripts whose slots are filled from the prompt. A skill streams thinking, tool calls and text, asks for a decision with a **widget** only when a person needs to decide, and applies **effects** that mutate `src/data` so every screen updates live. Spec: `docs/agent-catalog.md`.

```
src/agent/
  engine.ts            sessions, runner, step DSL (ctx), slots → understanding line, movie mode
  parse.ts             rule-based parser: people, units, sizes, money, dates, windows, segments …
  need.ts              slot resolvers that ask one question when needed (needTenant, needRecipients)
  data.ts              agent-side helpers: ledgerFor, moveIn, snapshot, CALENDAR, RESERVATIONS …
  skills/index.ts      router: SKILLS from all categories, route(q), fallback
  skills/<category>/   one file per skill + index.ts listing them          ← category agents
  widgets/frame.tsx    WP props contract, Frame, Rows, Seg, Toggle, defineWidget
  widgets/registry.ts  widget type → component (core + all ext maps)
  widgets/core/        shared widgets (W1–W5, W9, W10, W12–W15, W29–W31, W39, W42) + types.ts
  widgets/ext/<cat>.ts per-category widget maps                              ← category agents
  widgets/<category>/  per-category widget components                        ← category agents
```

Categories: `frontdesk money collections access facility growth comms reports day admin`.

**Ownership.** Category agents own `skills/<cat>/`, `widgets/<cat>/` and `widgets/ext/<cat>.ts`. Everything else in `src/agent` (engine, parser, need, registry, core widgets, workspace UI, `src/styles/agent.css`) has one maintainer: ask for changes instead of editing. Category widget CSS goes in **`src/styles/agent-<cat>.css`**, imported by your widget files, with the prefix the lead assigned (agent-frontdesk.css `agf-`, agent-money.css `agm-`, agent-access.css `aga-`, agent-growth.css `agg-`, agent-reports.css `agr-`). Reuse the core classes from `agent.css` listed at the end.

---

## 1. Add a skill

1. Create `src/agent/skills/<cat>/<camelName>.ts` with a default export.
2. Add it to `src/agent/skills/<cat>/index.ts`: `import refund from "./refund";` and `export const skills: Skill[] = [refund];`.

```ts
import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { needTenant } from "../../need";
import { money, snapshot } from "../../data";

export default defineSkill<{ who: string; amount: number | "balance" }>({
  id: "money.refund",                 // "<category>.<verb>", unique
  n: 15,                              // catalog number
  category: "money",
  title: "Refund",                    // tab + rail label
  featured: true,                     // list it in the rail
  examples: [                         // every one of these must work; [0] is canonical (rail, movie mode)
    "Refund Matthew Alvarez's duplicate charge",
    "Refund half of Ben's prepaid",
  ],
  slots: {                            // shown as chips in the understanding line
    who:    { label: "tenant", fill: q => q.people[0]?.name ?? q.ambiguous[0]?.said },
    amount: { label: "amount", fill: q => q.amounts[0], default: "balance",
              show: v => (v === "balance" ? "full amount" : money(v as number)) },
  },
  match: q => kw(q, [[/\brefund|charged twice|duplicate\b/, 4]]),   // 0 = not mine; ≥3 to win
  async run(ctx, { q, slots }) {
    await ctx.think("Find the duplicate, confirm the amount, refund to the original card.", 1100);
    const t = await needTenant(ctx, q, { prefer: x => (x.autopay ? 1 : 0) });
    ctx.focus({ tenants: [t.id], selected: t.unitIds[0] });
    // … tools, widgets, effects …
    ctx.suggest(["Text him a note", "Show his ledger"]);
  },
});
```

### Slots and the understanding line

`slots` declares what the skill needs. Before `run`, the engine fills each slot with `fill(q)`, falls back to `default`, and renders the **understanding line**: one mono chip per slot (`sms` · `Everyone past due · 12` · `rent reminder` · `send now`). A slot with `options` gets an editable chip; picking an option **re-runs the turn** with that value (only until the turn has applied an effect). Missing slots with no default show no chip; resolve them inside `run`.

| SlotSpec field | Meaning |
|---|---|
| `label` | chip label (`channel`, `tenant`, `amount`) |
| `fill(q)` | value from the parsed prompt, or `undefined` |
| `default` | value (or `q => value`) when `fill` finds nothing; chip is marked *default* |
| `show(v)` | chip text |
| `options(q)` | `{ value, label }[]` — makes the chip editable |
| `hidden` | fill but don't show |

`run` receives `{ q, slots }`, where `slots` holds the filled/defaulted values.

### What the parser gives you (`Parsed`, from `parse.ts`)

| Field | Example prompt → value |
|---|---|
| `people: PersonRef[]` | "Owen Murphy", "Okafor" (unique last name) → tenant or lead refs (`kind`, `id`, `name`, `phone`, `email`, `unit`, `tenant?`) |
| `ambiguous: { said, candidates }[]` | "Matthew" → 3 candidates |
| `newNames` | "Jordan Lee" (not in the data) |
| `units` | "C-112", "d118" → `["C-112","D-118"]` |
| `sizes` | "10x10", "10 by 20", "ten by ten" → `["10x10"]` |
| `amounts` | "$240", "240 dollars", "a check for 195" → `[240]` |
| `method` | cash · card · check |
| `channel` | sms · email · call |
| `count`, `countNoun` | "these 4 people" → 4, "people" |
| `dates` (ISO) | today, tomorrow, Friday (= today), Monday, Oct 12 |
| `window`, `time` | "1–5pm" → `{ from: "13:00", to: "17:00" }`; "at 3:30pm" → "15:30" |
| `buildings` | "Building D", "climate building" → `["D"]` |
| `percent`, `days` | "8%" → 8; "more than 15 days" → 15 |
| `segment` | "everyone past due", "15+ days late", "autopay failures", "this week's reservations", "10×20 tenants", "Building D tenants", "long-term tenants", "all tenants" → `{ id, label, noun, resolve() }` |
| `template`, `purpose` | reminder · promo · notice · welcome · followup; "about move-in times" → "move-in times" |
| `files` | attachments on the message |

Add a segment with `registerSegment({ test, make })` from your skill file (earlier rules win). Use `kw(q, [[regex, weight], …])` in `match`; negative weights push away near-misses. The router picks the highest score ≥ 3; ties go to the earlier category.

### Resolving slots that need a question (`need.ts`)

- `await needTenant(ctx, q, { prefer, title, filter })` → one `Tenant`. Unique name: returns (after a `tenants.search` row). Ambiguous: Disambiguate (W2) with the `prefer`-best badged "Likely match". None: asks with the top candidates from `filter`.
- `await needRecipients(ctx, q, "sms" | "email")` → `Recipient[]`. Asks RecipientSet (W3) when nobody is named, the count doesn't match ("these 4 people" with 3 names), or the audience is a segment worth reviewing.
- `toRecipient(personRef)`, `tenantRecipient(t)`, `segmentRecipients(segment)`, `commonSegments()`, `pool()` build recipients with merge data (`first unit size balance due_date code moving link`).
- For any other missing choice, ask one question with QuickReplies (W1): never a blank form.

### The step DSL (`ctx`)

| Step | Use |
|---|---|
| `await ctx.think(text, ms)` | collapsible "Thought for 1.2s" line |
| `await ctx.tool(name, args, result, ms)` | one tool row. `result` may be a function, evaluated when it finishes (reads live data) |
| `await ctx.tools([{ name, args, result, ms }, …])` | parallel tool rows; returns results |
| `await ctx.say(text)` | streamed text. `**bold**`, `` `mono` ``, `[label](ops/tenants/T-1000)` links, `- ` bullets |
| `await ctx.ask(type, props, auto)` | widget awaiting a decision → resolves with the typed answer |
| `const h = ctx.show(type, props)` | widget that doesn't wait; `h.update(patch)` or `h.update(p => patch)` to animate |
| `const id = ctx.effect({ kind, text, run, undo, link })` | mutate data, log to the session's **Actions taken** (with Undo if `undo`), `commit()` to the activity feed. Returns the action id (pass to Receipt for its Undo) |
| `ctx.event(text, tone)` | system event between turns ("Payment received · Grace Lindqvist · $219.00") |
| `ctx.focus({ tenants, selected, units, leads })` | context panel: entity cards, unit highlighted on the 3D twin, pulsing units |
| `ctx.suggest([...])` | 2–3 next-step chips under the turn |
| `await ctx.wait(ms)` | pause (honours movie speed and Stop) |
| `ctx.title(text)` | rename the session tab ("Payment · Matthew Okafor") |
| `await ctx.user(text)` | scripted follow-up user turn (typed into the composer in movie mode) |

Rules: numbers first, short sentences, sentence case, no exclamation marks, no emoji. Tool names are dotted verbs (`tenants.search`, `ledger.get`, `payments.record`, `gate.codes.create`, `units.available`, `leases.generate`, `esign.send`, `sms.send_batch`, `reports.generate`). Result JSON should look real and small. Every action needs: ≥2 working example prompts, a default for every slot it can default, at most one question when something is missing, and next chips.

### Effects

Mutate the shared objects in `src/data` (`TENANTS`, `UNITS`, `LEADS`, …) inside `run`, never directly in the script body, so the action log and undo stay correct. `snapshot(tenant)` returns an undo that restores the tenant and their units. `moveIn({...})` creates a tenant in a unit and returns `{ tenant, undo }`. `setUnitStatus(id, status)` and `removeLead(name)` return undos. The 3D twin, dashboards and profiles re-render from `commit()`.

### Movie mode

When Movie mode is on (demo bar), the canonical prompt is typed into the composer, and each `ask` plays its `auto` script after a readable pause with a visible cursor. Script steps:

| Step | Does |
|---|---|
| `"opt:T-1000"`, `"submit"`, any key | presses the element tagged `data-auto="<key>"` in that widget |
| `"type:<key>:<text>"` | types text into the input tagged `data-auto="<key>"` |
| `"slide:<key>:<value>"` | drags the range input tagged `data-auto="<key>"` |
| `"wait:<ms>"` | pauses |

`need*` helpers pick the top option automatically. Always pass an `auto` for every `ask`.

---

## 2. Add a widget

1. Create `src/agent/widgets/<cat>/<Name>.tsx`:

```tsx
import React, { useState } from "react";
import { BadgeDollarSign } from "lucide-react";
import { Button } from "../../../ui";
import { defineWidget, Frame, Rows, stateOf } from "../frame";
import "../../../styles/agent-money.css";

export interface RefundProps { txns: { id: string; label: string; amount: number }[]; card: string }
export type RefundAnswer = { ids: string[]; amount: number };

// W16 · Pick the transaction(s), full or partial. Movie mode: "txn:<id>", "submit".
export const RefundForm = defineWidget<RefundProps, RefundAnswer>(function RefundForm(w) {
  const { p, active, locked, answer } = w;
  const [ids, setIds] = useState<string[]>([p.txns[0].id]);
  const amount = p.txns.filter(t => ids.includes(t.id)).reduce((s, t) => s + t.amount, 0);
  return (
    <Frame
      icon={<BadgeDollarSign />}
      title="Refund"
      meta={p.card}
      tier="Ask first"
      {...stateOf(w, answer && `Refunded $${answer.amount.toFixed(2)} to ${p.card}`)}   // one-line summary once answered
      foot={<Button variant="primary" data-auto="submit" disabled={!active} onClick={() => w.respond({ ids, amount })}>Refund ${amount.toFixed(2)}</Button>}
    >
      …controls, all disabled={!active}, every pressable tagged data-auto…
    </Frame>
  );
});
```

2. Register it in **your** ext map, `src/agent/widgets/ext/<cat>.ts`:

```ts
import { RefundForm } from "../money/RefundForm";
export const widgets = { refund: RefundForm };
```

The key (`refund`) is the type you pass to `ctx.ask("refund", props, auto)`; props and answer are type-checked from `defineWidget<P, A>`. Keys are global: prefix generic names with your category if they might collide.

### The widget contract (`WP<P, A>`)

| Prop | Meaning |
|---|---|
| `p` | the props the skill passed |
| `active` | a decision is pending: enable controls |
| `locked` | answered or skipped: render read-only |
| `answer` | the value it was answered with |
| `respond(a)` | call once to answer; the skill's `await ctx.ask` resolves |
| `b.status` | `"active" \| "answered" \| "display" \| "skipped"` (`"display"` = shown with `ctx.show`) |
| `s` | the session (actions, focus) |

`Frame` handles the lifecycle: `state` from `stateOf(w, summary)` shows **Needs you** while active and, once answered, collapses the body to your one-line `summary` with a Details toggle. `keepOpen` keeps results visible; `state="live"` shows a Running spinner for `show`n widgets that are still updating; `flush` removes body padding for tables/lists; `tier="Ask first"` shows the permission badge. Use `Rows`, `Seg`, `Toggle` from `frame.tsx` and `Button`, `Avatar`, `Pill` from `src/ui`. Read live data with `useDemo()` when a widget shows records that effects change. Max one 3D view per widget, and only while it's active (WebGL contexts are limited): render a static summary when locked.

### Core widgets available to every skill (`widgets/core/types.ts`)

| Type key | W# | Props → answer |
|---|---|---|
| `quickReplies` | W1 | `{ question, options: {value,label,hint?}[], other? }` → `string` |
| `disambiguate` | W2 | `{ title, meta?, options: Candidate[] }` → candidate `id` |
| `recipients` | W3 | `{ channel, selected: Recipient[], segments?, pool?, cta? }` → `Recipient[]` |
| `bulkMessage` | W4 | `{ channel, channels?, recipients, subject?, templates: {friendly?,firm?,brief?}, tone?, drafts?, fields?, schedule? }` → `{ channel, subject, tone, template, schedule, messages: {id,name,to,text}[] }` |
| `delivery` | W5 | show: `{ channel, title?, rows: {id,name,to,state,at?,reply?}[] }` |
| `reportPreview` | W9 | `{ title, subtitle?, kpis, charts: ChartSpec[], narrative, pages, file, actions?, recipients? }` → `"send" \| "download" \| "schedule"` |
| `answer` | W10 | show: `{ label?, value?, context?, delta?, tiles?, items?, itemsTitle?, chart?, links? }` |
| `table` | W12 | `{ title, columns, rows: {id,cells,sort?,tone?,route?}[], selectable?, selected?, actions?, cta?, maxRows? }` → `{ ids, action? }` (or show it read-only) |
| `ledger` | W13 | show: `{ title, meta?, rows: LedgerRow[], foot? }` |
| `payment` | W14 | `{ payer, method, methods?, lines, receiptTo?, card?, after?, cta? }` → `{ method, amount, sms, card? }` |
| `receipt` | W15 | show: `{ no, payer, unit?, lines, method, balance, paidThrough?, sentTo?, triggered?, actionId?, links? }` |
| `plan` | W29 | `{ title, meta?, items: {id,label,sub?,group?,on?,tier?}[], impact?, cta?, secondary? }` → `{ ids }` or `{ secondary: true }` |
| `progress` | W30 | show: `{ title, items: {id,label,sub?,state,result?}[], summary? }` |
| `batch` | W31 | show: `{ title, cards: {id,title,sub?,avatar?,steps:{label,state,value?}[],total?}[], summary? }` |
| `diff` | W39 | `{ title, meta?, rows: {field,before,after}[], note?, cta?, secondary? }` → `"approve" \| "cancel"` |
| `callHandoff` | W42 | `{ name, phone, purpose, script, status, callId?, outcome? }` → `"call" \| "cancel"`; then `show` it with `status: "live"` |
| `entity` | — | show: `{ tenantId? , lead? }` tenant or reservation card |

`ChartSpec = { kind: "bar" | "line" | "meter", title?, data: {label,value,note?}[], format?: "money" | "pct" | "int", domain?, height? }` renders with `src/ui/charts.tsx` via `ChartView` in `widgets/core/chart.tsx`.

### CSS you can reuse (from `src/styles/agent.css`)

`ag-w` frame · `ag-rows` key-value rows · `ag-seg` segmented control · `ag-check` checkbox row · `ag-chips` / `ag-chip` reply chips · `ag-opts` / `ag-opt` option rows · `ag-badge` (`--warn`, `--bad`) · `ag-lbl` small label · `ag-w-note` footnote · `ag-w-warn` inline warning · `ag-more` text link button · `ag-spin` spinner · `ag-foot-hint` footer hint · `ag-delta is-ok|is-warn|is-bad`. Visual rules: `DESIGN.md` → Visual rules (v2). Tokens only, one blue accent, Geist + Geist Mono for ids/codes/money columns, no shadows beyond `--shadow-s`, no gradients, no emoji.

---

## 3. Already implemented (don't duplicate)

| Skill | File | Examples |
|---|---|---|
| #68 Morning briefing (now owned by the day agent) | `skills/day/briefing.ts` | "What needs my attention today?" |
| #13 Take a payment (now owned by the money agent; full widget is `stripePay`, core `payment` is the simple fallback) | `skills/money/takePayment.ts` | "Matthew came in and paid $240 cash" · "Okafor dropped off a check for 195" · "Charge Grace's card for her balance" |
| #55 + #54 Send SMS / email (now owned by the comms agent) | `skills/comms/sendMessages.ts` | "Text everyone past due a reminder" · "Text these 4 people their gate codes: …" · "Email Owen, Hana, Imani and Rafael about move-in times" · "Send a promo email to 10×20 tenants tomorrow" |
| Fallback | `skills/fallback.ts` | out-of-scope prompts, "what can you do" |

Workspace features owned by the engine maintainer: session tabs, rail (lists `featured` skills by category + recent sessions), context panel (3D twin from `ctx.focus`, entity cards, Actions taken with Undo), composer (`/` commands from skill titles, attachments `alder-lake-site-plan.pdf` / `rent-roll-sept.csv`, voice mode), home state, movie mode, `askAgent()` / ⌘K hand-off.

## 4. Next-step chips must route

`ctx.suggest` strings, home-screen prompts and every dashboard `askAgent()` prompt must reach a real skill. `node scripts/route-check.mjs` checks all skill examples plus `scripts/prompts.txt` (`prompt` = must not fall back, `prompt => skill.id` = must route there). Add your chips there. The engine drops a chip identical to the prompt just answered.

Movie scripts may name outcomes (`"approve"`, `"call"`, `"confirm"`): they resolve to the widget's `submit` button, and if a script ends with the widget still waiting the engine presses `submit` so a film never stalls.

## 5. Test your skill

Open `http://127.0.0.1:5173/#ops-agent`, type each example prompt, answer every widget, then check the effect landed on the relevant operator page. Turn on Movie mode and run the canonical prompt from the rail: it must play end to end without a click. `npx tsc --noEmit` must pass.
