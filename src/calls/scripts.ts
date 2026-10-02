import { commit, fmt } from "../state/store";
import { UNITS, UNIT_BY_ID } from "../data/facility";
import { TENANTS, TENANT_BY_ID, DELINQUENT, LEADS, type Tenant } from "../data/tenants";
import { greeting, voiceName, stats, campaigns, recent, type Campaign } from "./state";
import type { Call, RecentCall, Script, Step, Txt } from "./types";

// Scripted conversations. Each script is a list of steps the simulation plays:
// lines stream word by word, tools appear as chips, and some tools change the
// facility's data (a unit reserved, a balance cleared) and commit() it so every
// screen updates.

const ai = (text: Txt, o: { key?: string; alts?: string[]; aiText?: Txt } = {}): Step => ({ t: "say", who: "ai", text, ...o });
/** Who's speaking for us: Priya after a takeover, otherwise the voice persona. */
const me = (c: Call) => (c.handler === "human" ? "Priya" : voiceName());
const caller = (text: Txt, mood?: number): Step => ({ t: "say", who: "caller", text, mood });
const tool = (name: string, label: Txt, o: { running?: Txt; ms?: number; run?: (c: Call) => void } = {}): Step => ({ t: "tool", tool: name, label, ...o });
const wait = (ms: number): Step => ({ t: "wait", ms });
const hello = ai(() => greeting());
const WHO = "Zonera Voice";

function setStatus(id: string, s: "reserved" | "occupied" | "delinquent") {
  const u = UNIT_BY_ID.get(id);
  if (u) u.status = s;
}

// ---- Leila Haddad --------------------------------------------------------------
// Web lead from Sep 28 that stopped at payment. She calls in and books; later the
// agent can hand off an outbound call to finish payment ("leila-reservation").

export const LEILA = { unit: "", reserved: false, paid: false, waived: false };
export function leilaUnit() {
  if (LEILA.unit) return LEILA.unit;
  const pref = UNIT_BY_ID.get("C-107");
  if (pref && pref.status === "vacant") LEILA.unit = "C-107";
  else {
    const alt =
      UNITS.find(u => u.size === "10x10" && u.kind === "drive-up" && u.status === "vacant" && u.building === "C") ??
      UNITS.find(u => u.size === "10x10" && u.status === "vacant" && u.id !== "A-126");
    LEILA.unit = alt?.id ?? "C-107";
  }
  return LEILA.unit;
}
function reserveLeila() {
  if (LEILA.reserved) return;
  LEILA.reserved = true;
  const unit = leilaUnit();
  setStatus(unit, "reserved");
  const lead = LEADS.find(l => l.name === "Leila Haddad");
  if (lead) lead.note = `Reserved ${unit} by phone · payment link sent`;
  stats.bookings++;
  commit({ kind: "call", text: `Reserved ${unit} for Leila Haddad by phone · payment link sent`, who: WHO });
}

const leilaInbound: Script = {
  id: "leila-inbound",
  direction: "inbound",
  name: "Leila Haddad",
  phone: "(530) 555-0175",
  lead: true,
  intent: "Rent a 10×10 this week",
  preroll: 5,
  startOffset: 27,
  steps: [
    hello,
    caller("Hi, I started a reservation on your website last week but never finished it. I need a ten by ten, ideally this week.", 0.2),
    tool("crm.lookup", "Looked up Leila Haddad · lead", { running: "Matching caller ID…" }),
    ai("Found it. Your reservation from September 28 for a 10×10 stopped at the payment step. Are you still moving this week?"),
    caller("Yes, I'm moving out of my apartment on Saturday. It's mostly furniture and boxes.", 0.3),
    ai("Got it. A 10×10 fits a one-bedroom, so you're in the right size. Do you want drive-up access, or a climate-controlled unit indoors?"),
    caller("Drive-up. I'll have a rental truck, and there's a really heavy dresser.", 0.3),
    ai("Drive-up is perfect for that. Every drive-up unit is on the ground floor with a nine-foot roll-up door, so the dresser goes straight in. Let me see what's open this week."),
    tool("units.search", () => `Found 10×10 ${leilaUnit()} · drive-up · $189/mo`, { running: "Searching 10×10 drive-up units…", ms: 1700 }),
    ai(() => `I have ${leilaUnit()}, a drive-up 10×10 in Building C. It's $189 a month, and you can back the truck right up to the door. Want me to hold it for you?`),
    caller("That sounds perfect. What do I pay to get in?", 0.45),
    ai("It's $189 for the first month plus a $25 admin fee, so $214 today. Month to month, no contract.", { key: "price" }),
    caller("Okay, that works. Let's do it.", 0.6),
    tool("reservations.create", () => `Reserved ${leilaUnit()} · $189/mo`, { running: "Creating reservation…", run: reserveLeila }),
    ai(() => `Done. ${leilaUnit()} is reserved in your name for Saturday. I'm texting you a secure payment link now. Once it's paid, your gate code comes by text.`),
    tool("sms.send", "Sent payment link · (530) 555-0175", { running: "Sending text…" }),
    caller("Got it, I see the text. Can I get in early on Saturday?", 0.6),
    ai("The gate opens at 6 am every day and closes at 10 pm, so early is fine. Anything else I can help with?"),
    caller(() => `No, that's everything. Thanks, ${voiceName()}.`, 0.8),
    ai("You're welcome, Leila. See you Saturday."),
  ],
  whispers: [
    {
      text: "Waive the admin fee if she books today",
      match: /admin|fee|waive/i,
      ack: "Got it. I'll waive the $25 admin fee when we get to price.",
      line: () => {
        LEILA.waived = true;
        return "Normally there's a $25 admin fee, but I can waive it if you book today, so it's just $189 to get in. Month to month, no contract.";
      },
      replaces: "price",
    },
    {
      text: "Text her directions to the unit",
      match: /direction|route|map|find/i,
      ack: "Will do. I'll text directions from the gate.",
      line: () => `I'll also text you directions from the gate to ${leilaUnit()}, so you can drive straight there.`,
    },
    {
      text: "Mention the protection plan",
      match: /protect|insur|cover/i,
      ack: "Okay. I'll mention protection next.",
      line: "One more thing: protection plans start at $12 a month and cover up to $2,000 of your belongings. I can add it any time.",
    },
  ],
  outcome: () => `Booked ${leilaUnit()} · payment link sent`,
  summary: () =>
    `Leila Haddad (web lead, Sep 28) called to finish her 10×10. Zonera Voice matched her reservation, held ${leilaUnit()} (drive-up, $189/mo) for a Saturday move-in and texted a payment link.${LEILA.waived ? " Admin fee waived at Priya's request." : ""} Gate code goes out once paid.`,
  tone: "ok",
};

const leilaOutbound: Script = {
  id: "leila-reservation",
  direction: "outbound",
  name: "Leila Haddad",
  phone: "(530) 555-0175",
  lead: true,
  intent: "Finish her 10×10 reservation",
  steps: [
    caller("Hello?", 0.1),
    ai(c => `Hi Leila, this is ${me(c)} from Zonera Alder Lake. I'm calling to finish your 10×10 reservation. Do you have a minute?`),
    caller("Oh, yes. I meant to finish that.", 0.3),
    tool("crm.lookup", "Looked up Leila Haddad · lead", { running: "Opening lead…" }),
    tool("reservations.get", () => (LEILA.reserved ? `Found reservation · ${leilaUnit()}` : `Reserved ${leilaUnit()} · $189/mo`), { running: "Checking reservation…", run: reserveLeila }),
    ai(() => `You're set for ${leilaUnit()}, a drive-up 10×10 at $189 a month. The only step left is payment. I can text you a secure link, or take the card now.`),
    caller("Text me the link. I'll do it right now.", 0.4),
    tool("sms.send", "Sent payment link · (530) 555-0175", { running: "Sending text…" }),
    wait(1600),
    caller("Okay… done.", 0.5),
    tool("payments.capture", () => `Payment received · ${LEILA.waived ? "$189.00" : "$214.00"} · Mastercard •• 7731`, {
      running: "Waiting for payment…",
      ms: 2000,
      run: () => {
        LEILA.paid = true;
        const lead = LEADS.find(l => l.name === "Leila Haddad");
        if (lead) lead.note = `Paid · ${leilaUnit()} ready for Saturday`;
        commit({ kind: "call", text: `Leila Haddad paid ${LEILA.waived ? "$189" : "$214"} on a call · ${leilaUnit()} ready for Saturday`, who: WHO });
      },
    }),
    tool("gate.issueCode", () => `Issued gate code · ${leilaUnit()}`, { running: "Issuing gate code…" }),
    ai(() => `Payment's in, ${LEILA.waived ? "$189" : "$214 including the admin fee"}. Your gate code is on its way by text, and ${leilaUnit()} is ready for Saturday.`),
    caller("Amazing. Thank you so much.", 0.8),
    ai("See you Saturday, Leila."),
  ],
  whispers: [
    {
      text: "Remind her the gate opens at 6 am",
      match: /gate|6|early|hours/i,
      ack: "Okay, I'll mention gate hours.",
      line: "And the gate opens at 6 am, so you can start as early as you like.",
    },
  ],
  outcome: () => `Paid · ${leilaUnit()} ready for Saturday`,
  summary: () => `Agent mode handed this call to Zonera Voice to finish Leila Haddad's reservation. She paid by text link during the call; ${leilaUnit()} is reserved and paid, and her gate code was issued for a Saturday move-in.`,
  tone: "ok",
};

// ---- Matthew Alvarez · gate code ------------------------------------------------

const MATTHEW = { code: "4827" };
const spaced = (s: string) => s.split("").join("-");

const matthewGate: Script = {
  id: "matthew-gate",
  direction: "inbound",
  name: "Matthew Alvarez",
  phone: "(530) 555-0133",
  tenantId: "T-1001",
  intent: "Gate code not working",
  preroll: 5,
  startOffset: 66,
  steps: [
    hello,
    caller("Hey, I'm at the front gate and my code isn't working. I've got a truck full of stuff.", -0.45),
    tool("tenants.lookup", "Matched caller ID · Matthew Alvarez · B-122", { running: "Matching caller ID…" }),
    ai("Sorry about that, Matthew. I can fix it right now. For security, can you tell me the last four digits of the card on file?"),
    caller("Yeah, it's 4242.", -0.3),
    tool("identity.verify", "Verified identity · Visa •• 4242", { running: "Verifying…" }),
    tool("gate.events", "Checked gate log · 3 denied entries at Gate 1", { running: "Reading gate log…" }),
    ai("Thanks, you're verified. I see three denied entries in the last few minutes. Your code didn't sync after this morning's keypad update, so I'll reset it now."),
    caller("Okay. How long does that take?", -0.2),
    tool("gate.resetCode", () => `Reset gate code · B-122 · new code ${MATTHEW.code}`, {
      running: "Resetting code…",
      run: () => {
        const t = TENANT_BY_ID.get("T-1001");
        if (t) t.gateCode = MATTHEW.code;
        commit({ kind: "call", text: "Reset the gate code for Matthew Alvarez (B-122) after 3 denied entries", who: WHO });
      },
    }),
    ai(() => `It's done. Your new code is ${spaced(MATTHEW.code)}. I'm texting it to you too. Want me to open the gate for you now?`, { key: "code" }),
    caller("Yes, please.", 0.1),
    tool("gate.open", "Opened Gate 1 remotely", {
      running: "Opening Gate 1…",
      run: () => commit({ kind: "gate", text: "Gate 1 · B-122 Matthew Alvarez · opened remotely by Zonera Voice", who: WHO }),
    }),
    ai("Gate 1 is opening. B-122 is in the second lane on your right, about halfway down."),
    caller("It's open. Great, thank you.", 0.6),
    ai("Anytime, Matthew. The new code works on both gates. Good luck with the move."),
  ],
  whispers: [
    {
      text: "Offer him a dolly from the office",
      match: /dolly|cart|trolley/i,
      ack: "Sure. I'll mention the dollies.",
      line: "Also, there are free dollies and carts by the office door if you need them.",
    },
    {
      text: "Ask if anyone else needs access",
      match: /anyone|else|access|second|family/i,
      ack: "Okay, I'll ask about other users.",
      line: "Does anyone else need access to B-122? I can add a second code for them.",
    },
  ],
  outcome: "Gate code reset · gate opened",
  summary: () => `Matthew Alvarez (B-122) was stuck at Gate 1 after this morning's keypad update. Zonera Voice verified him by card, reset his code to ${MATTHEW.code}, texted it and opened the gate remotely. No staff needed.`,
  tone: "ok",
};

// ---- Grace Lindqvist · autopay campaign ------------------------------------------

const graceAutopay: Script = {
  id: "grace-autopay",
  direction: "outbound",
  name: "Grace Lindqvist",
  phone: "(530) 555-0172",
  tenantId: "T-1006",
  intent: "Autopay failed · update card",
  campaign: "autopay",
  preroll: 3,
  startOffset: 38,
  steps: [
    caller("Hello, this is Grace.", 0),
    ai(() => `Hi Grace, this is ${voiceName()}, the virtual assistant at Zonera Alder Lake. I'm calling about your storage account. Is now an okay time?`),
    caller("Oh, sure. Is something wrong?", -0.1),
    tool("ledger.get", "Checked ledger · $219.00 due · 9 days", { running: "Reading ledger…" }),
    ai("Nothing serious. Your autopay on September 23 didn't go through because the Visa ending 0077 expired. The balance is $219."),
    caller("Ugh, I got a new card and forgot to update it. Can I fix that now?", 0.1),
    ai("Of course. I'll text you a secure link so the card number is never read out loud. It takes about thirty seconds."),
    tool("sms.send", "Sent secure card link · (530) 555-0172", { running: "Sending link…" }),
    caller("Okay, it's open. Entering it now.", 0.2),
    wait(1800),
    tool("cards.update", "Updated card on file · Visa •• 8806", { running: "Waiting for card…", ms: 2200 }),
    tool("payments.charge", "Charged $219.00 · Visa •• 8806 · balance cleared", {
      running: "Charging $219.00…",
      run: () => {
        const t = TENANT_BY_ID.get("T-1006");
        if (t) {
          t.balance = 0;
          t.daysLate = 0;
          t.card = "Visa •• 8806";
          t.autopay = true;
          t.lastContact = "Oct 2 · AI call, card updated";
          t.notes = "Card updated by phone on Oct 2. Autopay back on.";
          for (const u of t.unitIds) setStatus(u, "occupied");
        }
        commit({ kind: "call", text: "Grace Lindqvist updated her card on an AI call · $219.00 collected, autopay back on", who: WHO });
      },
    }),
    ai("Got it. Your new Visa ending 8806 is on file and the $219 balance is paid. Autopay is back on for November 1.", { key: "paid" }),
    caller("Perfect. Thank you for calling.", 0.7),
    ai("Thanks, Grace. Have a good rest of your day."),
  ],
  whispers: [
    {
      text: "Thank her for two years with us",
      match: /thank|two years|loyal|anniversary/i,
      ack: "Will do.",
      line: "And thank you for being with us for almost two years. We really appreciate it.",
    },
    {
      text: "Tell her there's no late fee",
      match: /late fee|waive|no fee/i,
      ack: "Okay. I'll confirm there's no late fee.",
      line: "And there's no late fee on this one, since the card had simply expired.",
    },
  ],
  outcome: "Card updated · $219 collected",
  summary: "Grace Lindqvist (D-118) missed the Sep 23 autopay on an expired Visa. Zonera Voice texted a secure card link during the call; the new Visa •• 8806 was saved, $219.00 collected and autopay re-enabled for Nov 1.",
  tone: "ok",
};

// ---- Dana Whitfield · upset about the lien --------------------------------------

export const DANA = { resolved: false, callback: false };

const danaLien: Script = {
  id: "dana-lien",
  direction: "inbound",
  name: "Dana Whitfield",
  phone: "(530) 555-0166",
  tenantId: "T-1004",
  intent: "Upset about lien notice",
  steps: [
    hello,
    caller("I got a letter saying you're going to sell my things. Are you serious? Nobody even called me.", -0.85),
    tool("tenants.lookup", "Matched caller ID · Dana Whitfield · A-131", { running: "Matching caller ID…" }),
    tool("lien.status", "Lien sale scheduled Oct 9 · $448 past due", { running: "Checking lien status…" }),
    ai("I'm sorry, Dana. That's a stressful letter to get. I can see A-131 is 47 days past due and a lien sale is scheduled for October 9. Nothing has been sold, and nothing happens today."),
    caller("I've been in the hospital for a month. My mail was going to my sister's. I had no idea.", -0.6),
    tool("crm.note", "Added note · hospital stay, mail at sister's address", { running: "Adding note…" }),
    ai("I'm really sorry you've been dealing with that, and thank you for telling me. Pausing a sale needs a manager, so I'd like to bring in Priya, our facility manager. Is that okay?"),
    caller("Yes. Please.", -0.3),
    ai("Thank you. She's joining now. I've noted your hospital stay on your account, so you won't have to explain it again."),
    {
      t: "escalate",
      reason: "Lien pause needs a manager",
      detail: "Dana Whitfield · A-131 · sale Oct 9. Pausing a lien sale is set to Ask first.",
      timeoutMs: 32000,
      ifHuman: [
        ai("Hi Dana, this is Priya, the manager. I'm so sorry about that letter. I'm pausing the sale right now, so you have time.", {
          alts: ["Hi Dana, it's Priya. First thing: the sale is on hold. Let's sort out the rest together."],
          aiText: "Priya has approved it, so I'm pausing the sale right now. You have time.",
        }),
        tool("lien.pause", "Paused lien sale · A-131 · approved by Priya", {
          running: "Pausing lien sale…",
          run: () => {
            DANA.resolved = true;
            const t = TENANT_BY_ID.get("T-1004");
            if (t) {
              t.notes = "Hospital stay Sep 1–29, mail went to her sister's. Lien sale paused by Priya on Oct 2. Plan: $224 Oct 2, $224 Oct 16.";
              t.lastContact = "Oct 2 · Call with Priya";
            }
            commit({ kind: "call", text: "Priya paused the A-131 lien sale on a call with Dana Whitfield", who: "Priya Raman" });
          },
        }),
        caller("Thank you. I can pay some of it today, but not all of it.", 0.1),
        ai("That's completely fine. Let's split it: $224 today and $224 on October 16, with no extra fees. Does that work for you?", {
          alts: ["Would $224 today and the rest on October 16 work for you?"],
        }),
        caller("Yes, that works. Thank you, really.", 0.6),
        tool("payments.plan", "Payment plan · $224 today · $224 Oct 16", { running: "Setting up plan…" }),
        tool("payments.charge", "Charged $224.00 · Visa •• 3310 · overlock removed", {
          running: "Charging $224.00…",
          run: () => {
            const t = TENANT_BY_ID.get("T-1004");
            if (t) t.balance = 224;
            setStatus("A-131", "delinquent");
            commit({ kind: "call", text: "Dana Whitfield paid $224 by phone · $224 due Oct 16 · A-131 overlock removed", who: "Priya Raman" });
          },
        }),
        ai("You're all set. I've removed the overlock, so you can get into A-131 today, and you'll get a text with the plan.", {
          alts: ["Done. The overlock is off and the plan is on its way by text."],
        }),
        caller("Okay. Thank you, Priya.", 0.7),
        ai("Take care, Dana. Call me directly if anything comes up."),
      ],
      ifAI: [
        ai("Priya is finishing another call, so here's what I've done: I've asked her to review a pause on the sale, and she'll call you back within the hour. Nothing will happen to your unit before then."),
        tool("tasks.create", "Callback task for Priya · within 1 hour", {
          running: "Creating task…",
          run: () => {
            DANA.callback = true;
            commit({ kind: "alert", text: "Callback for Dana Whitfield within the hour · lien pause requested", who: WHO });
          },
        }),
        caller("Okay. Thank you for listening.", 0.2),
        ai("Of course, Dana. Talk soon."),
      ],
    },
  ],
  whispers: [
    {
      text: "Tell her nothing happens before Oct 9",
      match: /nothing|before|oct|safe/i,
      ack: "Understood. I'll reassure her on timing.",
      line: "And to be clear, nothing can happen to your things before October 9, and we can move that date.",
    },
  ],
  outcome: () => (DANA.resolved ? "Lien paused · plan agreed · $224 paid" : "Manager callback within 1 hour"),
  summary: () =>
    DANA.resolved
      ? "Dana Whitfield (A-131, 47 days late) called upset about the lien notice; she'd been in the hospital and her mail went to her sister's. Zonera Voice de-escalated, noted it and asked Priya to join. Priya paused the Oct 9 sale and agreed a plan: $224 paid today, $224 due Oct 16. Overlock removed."
      : "Dana Whitfield (A-131) called upset about the lien notice after a hospital stay. Zonera Voice de-escalated and requested a manager; Priya was busy, so a callback within the hour was booked and the sale flagged for review.",
  tone: "warn",
};

// ---- Price shopper · $1 first month on 10×20 --------------------------------------

const SHOPPER = { unit: "", reserved: false };
function shopperUnit() {
  if (!SHOPPER.unit) SHOPPER.unit = UNITS.find(u => u.size === "10x20" && u.status === "vacant")?.id ?? "A-101";
  return SHOPPER.unit;
}

const priceShopper: Script = {
  id: "price-shopper",
  direction: "inbound",
  name: "New caller",
  phone: "(530) 555-0193",
  intent: "Price check · 10×20",
  steps: [
    hello,
    caller("Hi, I'm calling around for prices. What do you get for a ten by twenty?", 0),
    tool("rates.get", "10×20 drive-up · $319/mo · 4 available", { running: "Checking rates…" }),
    tool("promos.active", "Promo active · $1 first month on 10×20", { running: "Checking promotions…" }),
    ai("A 10×20 drive-up is $319 a month, and right now your first month is $1. I have four available."),
    caller("A dollar? What's the catch?", 0.2),
    ai("No catch. It's month to month, no contract. You'd pay $1 plus the $25 admin fee today, then $319 from November."),
    caller("Huh. The place on Route 50 quoted me $289.", -0.1),
    ai("That's fair to compare. With the $1 first month you're still ahead until April, and every unit here is drive-up with cameras on each lane. Want me to hold one? Reserving is free.", { key: "compare" }),
    caller("Yeah, okay. Hold one for the 10th. The name's Marcus Ward.", 0.5),
    { t: "do", run: c => (c.name = "Marcus Ward") },
    tool("units.search", () => `Found 10×20 ${shopperUnit()} · drive-up`, { running: "Finding a 10×20…" }),
    tool("reservations.create", () => `Reserved ${shopperUnit()} · $1 first month`, {
      running: "Creating reservation…",
      run: () => {
        if (SHOPPER.reserved) return;
        SHOPPER.reserved = true;
        setStatus(shopperUnit(), "reserved");
        LEADS.push({ name: "Marcus Ward", size: "10x20", source: "Phone call", moving: "Oct 10", reserved: "Oct 2", phone: "(530) 555-0193", note: `$1 first month · reserved ${shopperUnit()} by phone` });
        stats.bookings++;
        commit({ kind: "lead", text: `Marcus Ward reserved ${shopperUnit()} by phone · $1 first month`, who: WHO });
      },
    }),
    ai(() => `Done, Marcus. ${shopperUnit()} is held for October 10 at $1 for the first month. I'm texting you the details now.`),
    tool("sms.send", "Sent reservation details · (530) 555-0193", { running: "Sending text…" }),
    caller("Great, thanks.", 0.6),
    ai("Thanks for calling, Marcus. See you on the 10th."),
  ],
  whispers: [
    {
      text: "Match $289 for the first six months",
      match: /match|289|route 50|beat/i,
      ack: "Understood. I'll offer to match $289 for six months.",
      line: "And if it helps, I can match $289 a month for your first six months, on top of the $1 first month. Want me to hold one? Reserving is free.",
      replaces: "compare",
    },
  ],
  outcome: () => `Reserved ${shopperUnit()} · $1 first month`,
  summary: () => `New caller shopping 10×20 prices. Zonera Voice quoted $319/mo with the $1 first month promo, handled a competitor comparison ($289 on Route 50) and reserved ${shopperUnit()} for Marcus Ward, moving Oct 10.`,
  tone: "ok",
};

export const SCRIPTS: Record<string, Script> = {
  [leilaInbound.id]: leilaInbound,
  [leilaOutbound.id]: leilaOutbound,
  [matthewGate.id]: matthewGate,
  [graceAutopay.id]: graceAutopay,
  [danaLien.id]: danaLien,
  [priceShopper.id]: priceShopper,
};

// ---- Generic outbound calls (dialer, campaigns, agent hand-offs) -----------------

export type Purpose = "payment" | "reservation" | "movein" | "custom";
export const PURPOSES: { id: Purpose; label: string }[] = [
  { id: "payment", label: "Payment reminder" },
  { id: "reservation", label: "Reservation follow-up" },
  { id: "movein", label: "Move-in confirmation" },
  { id: "custom", label: "Custom" },
];

export function purposeKind(p: string): Purpose {
  if (/pay|balance|past due|autopay|reminder|late|card/i.test(p)) return "payment";
  if (/reserv|follow|lead|book/i.test(p)) return "reservation";
  if (/move-?\s?in|confirm/i.test(p)) return "movein";
  return "custom";
}

export interface Contact { name: string; phone: string; tenantId?: string; lead?: boolean; sub: string }

export function contacts(): Contact[] {
  const lead = LEADS.map(l => ({ name: l.name, phone: l.phone, lead: true, sub: `Lead · ${l.size.replace("x", "×")} · moving ${l.moving}` }));
  const ten = TENANTS.map(t => ({ name: t.name, phone: t.phone, tenantId: t.id, sub: `${t.unitIds.join(", ")} · ${t.balance > 0 ? fmt.money(t.balance) + " due" : "paid up"}` }));
  return [...lead, ...ten];
}

export function genericScript(req: { name: string; phone?: string; tenantId?: string; purpose: string; kind?: Purpose }): Script {
  const t: Tenant | undefined = req.tenantId ? TENANT_BY_ID.get(req.tenantId) : TENANTS.find(x => x.name.toLowerCase() === req.name.toLowerCase());
  const l = LEADS.find(x => x.name.toLowerCase() === req.name.toLowerCase());
  const first = req.name.split(" ")[0];
  const phone = req.phone ?? t?.phone ?? l?.phone ?? "(530) 555-0100";
  const kind = req.kind ?? purposeKind(req.purpose);
  const unit = t?.unitIds[0];
  const base = { id: "generic-" + kind, direction: "outbound" as const, name: req.name, phone, tenantId: t?.id, lead: !t && !!l };
  const intro = (what: string) => ai(c => `Hi ${first}, this is ${me(c)} from Zonera Alder Lake. ${what}`);

  if (kind === "payment") {
    const bal = t?.balance ?? 0;
    return {
      ...base,
      intent: "Payment reminder",
      steps: [
        caller("Hello?", 0),
        intro("I'm calling about your storage account. Is now an okay time?"),
        caller("Sure, go ahead.", 0),
        tool("ledger.get", bal > 0 ? `Checked ledger · ${fmt.money(bal, true)} due` : "Checked ledger · paid up", { running: "Reading ledger…" }),
        bal > 0
          ? ai(`Your balance is ${fmt.money(bal)}${t?.daysLate ? `, ${t.daysLate} days past due on ${unit}` : ""}. I can text you a secure payment link, or set up a plan if that's easier.`)
          : ai(`Good news, your account is paid up. I'm just confirming autopay for November 1 on your ${t?.card ?? "card on file"}.`),
        caller(bal > 0 ? "Text me the link. I'll pay it today." : "Great, thanks for checking.", 0.3),
        tool("sms.send", bal > 0 ? `Sent payment link · ${phone}` : `Sent confirmation · ${phone}`, { running: "Sending text…" }),
        ai("Done, you'll have it in a few seconds. Anything else I can help with?"),
        caller("No, that's all.", 0.4),
        ai(`Thanks, ${first}. Have a good day.`),
      ],
      outcome: bal > 0 ? "Payment link sent · promised today" : "Autopay confirmed",
      summary: bal > 0 ? `${req.name}${unit ? ` (${unit})` : ""} was reminded about a ${fmt.money(bal)} balance. Payment link texted; promised to pay today.` : `${req.name} is paid up; autopay confirmed for Nov 1.`,
      tone: "info",
    };
  }
  if (kind === "reservation") {
    const size = (l?.size ?? "10x10").replace("x", "×");
    return {
      ...base,
      intent: "Reservation follow-up",
      steps: [
        caller("Hello?", 0),
        intro(`You reserved a ${size} with us, and I wanted to make sure you're all set${l ? ` for ${l.moving}` : ""}.`),
        caller("Oh, hi. Yes, still planning on it.", 0.3),
        tool("reservations.get", `Found reservation · ${size}`, { running: "Opening reservation…" }),
        ai("Great. Would you like to finish the rental now, so you can skip the counter on move-in day? It takes about two minutes."),
        caller("Sure, send me what I need.", 0.4),
        tool("sms.send", `Sent rental link · ${phone}`, { running: "Sending text…" }),
        ai("Sent. Your gate code arrives as soon as it's done. Anything else?"),
        caller("No, that's perfect. Thanks.", 0.6),
        ai(`Thanks, ${first}. See you soon.`),
      ],
      outcome: "Rental link sent",
      summary: `Followed up on ${req.name}'s ${size} reservation. Confirmed the move date and texted the rental link to finish online.`,
      tone: "info",
    };
  }
  if (kind === "movein") {
    return {
      ...base,
      intent: "Move-in confirmation",
      steps: [
        caller("Hello?", 0),
        intro(`I'm calling to confirm your move-in${unit ? ` at ${unit}` : ""}. Is tomorrow morning still good?`),
        caller("Yes, we'll be there around ten.", 0.4),
        tool("gate.issueCode", `Gate code ready${unit ? ` · ${unit}` : ""}`, { running: "Checking access…" }),
        ai("Perfect. Your gate code is active from 6 am, and I'll text you the route from the gate to your door."),
        caller("Great, thank you.", 0.6),
        ai(`See you tomorrow, ${first}.`),
      ],
      outcome: "Move-in confirmed",
      summary: `Confirmed ${req.name}'s move-in for tomorrow at about 10 am. Gate code active from 6 am; route texted.`,
      tone: "ok",
    };
  }
  const what = req.purpose.replace(/\.$/, "");
  return {
    ...base,
    intent: what.charAt(0).toUpperCase() + what.slice(1),
    steps: [
      caller("Hello?", 0),
      intro(`I'm calling about ${what.charAt(0).toLowerCase() + what.slice(1)}. Do you have a minute?`),
      caller("Sure. What do you need?", 0.2),
      tool("crm.note", `Added note · ${what}`, { running: "Opening account…" }),
      ai(`Thanks. I've noted it on your account. Is ${phone} still the best number to reach you?`),
      caller("Yes, that's the one.", 0.3),
      ai(`Great. I'll text you a short summary. Thanks, ${first}.`),
    ],
    outcome: "Done · summary texted",
    summary: `Called ${req.name} about ${what}. Noted on the account and texted a summary.`,
    tone: "info",
  };
}

// ---- Earlier today + campaigns --------------------------------------------------

const STORY_IDS = new Set(["T-1000", "T-1001", "T-1002", "T-1003", "T-1004", "T-1005", "T-1006"]);

export function seedCampaignsAndRecent() {
  const late = DELINQUENT.filter(t => !STORY_IDS.has(t.id));
  const done = late.slice(0, 3);
  campaigns.push(
    {
      id: "autopay",
      name: "Payment reminders",
      sub: "Autopay failures and past-due balances",
      purpose: "Payment reminder",
      queued: late.slice(3, 12).map(t => ({ name: t.name, tenantId: t.id, phone: t.phone, note: `${t.unitIds[0]} · ${fmt.money(t.balance)} · ${t.daysLate}d` })),
      done: 3,
      running: true,
      window: "Weekdays 10 am – 6 pm",
    },
    {
      id: "leads",
      name: "Reservation follow-ups",
      sub: "Reservations that haven't paid",
      purpose: "Reservation follow-up",
      queued: LEADS.filter(l => l.name !== "Owen Murphy" && l.name !== "Hana Sato").map(l => ({ name: l.name, phone: l.phone, note: `${l.size.replace("x", "×")} · moving ${l.moving}` })),
      done: 2,
      running: false,
      window: "Starts 11:00 am",
    },
    {
      id: "movein",
      name: "Move-in confirmations",
      sub: "Tomorrow's move-ins",
      purpose: "Move-in confirmation",
      queued: [
        { name: "Owen Murphy", phone: "(530) 555-0114", note: "10×20 · Oct 3, 10 am" },
        { name: "Hana Sato", phone: "(530) 555-0129", note: "5×10 · Oct 3, 1 pm" },
        { name: "Imani Mensah", phone: "(530) 555-0149", note: "10×15 · Oct 3, 4 pm" },
      ],
      done: 0,
      running: false,
      window: "Tomorrow 9:00 am",
    },
  );

  const seed: RecentCall[] = [
    { id: "CL-2039", at: "9:39 am", name: done[0]?.name ?? "Kai Novak", phone: done[0]?.phone ?? "(530) 555-0181", tenantId: done[0]?.id, direction: "outbound", intent: "Payment reminder", outcome: "Payment link sent · promised today", tone: "info", duration: 94, mood: 0.2, by: "ai", summary: `Reminded about a ${fmt.money(done[0]?.balance ?? 219)} balance on ${done[0]?.unitIds[0] ?? "B-117"}. Payment link texted; promised to pay by end of day.` },
    { id: "CL-2038", at: "9:36 am", name: "Owen Murphy", phone: "(530) 555-0114", direction: "inbound", intent: "Will a 10×20 fit a 3-bedroom", outcome: "Size confirmed · Oct 12", tone: "ok", duration: 108, mood: 0.6, by: "ai", summary: "Owen asked whether a 10×20 fits a three-bedroom house. Zonera Voice confirmed the size, noted the Oct 12 move with a truck rental and texted the drive-up map." },
    { id: "CL-2037", at: "9:33 am", name: done[1]?.name ?? "Mia Larsen", phone: done[1]?.phone ?? "(530) 555-0122", tenantId: done[1]?.id, direction: "outbound", intent: "Payment reminder", outcome: "Card updated · paid", tone: "ok", duration: 131, mood: 0.5, by: "ai", summary: `Expired card on file. Sent a secure link during the call; card updated and ${fmt.money(done[1]?.balance ?? 189)} collected.` },
    { id: "CL-2036", at: "9:30 am", name: done[2]?.name ?? "Leo Park", phone: done[2]?.phone ?? "(530) 555-0144", tenantId: done[2]?.id, direction: "outbound", intent: "Payment reminder", outcome: "Voicemail · SMS sent", tone: "neutral", duration: 38, mood: 0, by: "ai", summary: "No answer. Left a short voicemail and texted the payment link." },
    { id: "CL-2035", at: "9:24 am", name: "(530) 555-0108", phone: "(530) 555-0108", direction: "inbound", intent: "Office and gate hours", outcome: "Answered", tone: "neutral", duration: 38, mood: 0.2, by: "ai", summary: "Caller asked for office and gate hours. Answered; no follow-up needed." },
    { id: "CL-2034", at: "9:09 am", name: "Sofia Reyes", phone: "(530) 555-0121", tenantId: "T-1003", direction: "inbound", intent: "Bigger unit", outcome: "Transfer quote sent", tone: "info", duration: 192, mood: 0.5, by: "ai", summary: "Sofia wants to move from C-108 (5×10) to a 10×10. Zonera Voice quoted C-117 at $189/mo with proration and sent the transfer addendum to sign." },
    { id: "CL-2033", at: "8:51 am", name: "Ben Carter", phone: "(530) 555-0158", tenantId: "T-1005", direction: "inbound", intent: "Move-out date", outcome: "Move-out booked Oct 31", tone: "ok", duration: 82, mood: 0.4, by: "ai", summary: "Ben confirmed he's moving out of B-141 at the end of October. Prepaid through Oct 31; inspection booked for 3:30 pm today." },
    { id: "CL-2032", at: "8:33 am", name: "Rafael Costa", phone: "(530) 555-0102", direction: "inbound", intent: "Insurance for kitchen equipment", outcome: "Escalated to Priya", tone: "warn", duration: 245, mood: 0, by: "human", summary: "Rafael asked whether protection covers commercial kitchen equipment. Zonera Voice explained the $10,000 plan and brought in Priya for a certificate of insurance." },
    { id: "CL-2031", at: "7:12 am", name: "Hana Sato", phone: "(530) 555-0129", direction: "inbound", intent: "Move-in time", outcome: "Answered", tone: "ok", duration: 65, mood: 0.5, by: "ai", afterHours: true, summary: "Hana asked when she can move in on Monday. Gate opens at 6 am; office paperwork can be finished online." },
    { id: "CL-2030", at: "6:02 am", name: "(530) 555-0131", phone: "(530) 555-0131", direction: "inbound", intent: "Locked out at the gate", outcome: "Verified · gate opened", tone: "ok", duration: 130, mood: 0.3, by: "ai", afterHours: true, summary: "Tenant locked out before office hours. Verified by card on file and opened Gate 1 remotely." },
    { id: "CL-2029", at: "2:41 am", name: "Lakeside Alarm Co.", phone: "(530) 555-0199", direction: "inbound", intent: "Door alarm, Building D", outcome: "Checked cameras · false alarm", tone: "info", duration: 97, mood: 0, by: "ai", afterHours: true, summary: "Monitoring reported a door-contact alarm on D-2. Zonera Voice checked cameras and gate logs (no entries since 10:02 pm), closed it as a sensor fault and opened a work order." },
  ];
  recent.push(...seed);
}
