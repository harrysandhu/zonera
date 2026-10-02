import { UNIT_BY_ID } from "../../../data/facility";
import { TENANTS, type Tenant } from "../../../data/tenants";
import { GATE_EVENTS, GATE_BY_ID } from "../../../data/gate";
import { TODAY, addDays, rng, seedOf, lifetime, ledgerFor, nextBillDate, longDate, shortDate } from "../../../data/ledger";
import { commsFor, lastTouch } from "../../../data/comms";
import { MOVE_OUTS } from "../../../data/leases";

// Derived views for the customer profile: gate history and the agent's read.

export interface GateRow { date: string; min: number; gate: string; kind: "Entry" | "Exit" | "Denied" | "Keypad exit"; note?: string; today?: boolean }

function toMin(at: string) {
  const m = /(\d+):(\d+)\s*(am|pm)/.exec(at);
  if (!m) return 0;
  let h = +m[1] % 12;
  if (m[3] === "pm") h += 12;
  return h * 60 + +m[2];
}

const HIST = new Map<string, GateRow[]>();

/** Last 8 weeks of gate events for a tenant: today's live log plus a deterministic history. */
export function gateHistory(t: Tenant): GateRow[] {
  const today: GateRow[] = GATE_EVENTS.filter(e => e.tenantId === t.id).map(e => ({
    date: TODAY,
    min: toMin(e.at),
    gate: GATE_BY_ID.get(e.gate)?.short ?? e.gate,
    kind: e.kind === "denied" ? "Denied" : e.kind === "exit" ? "Exit" : e.kind === "fallback" ? "Keypad exit" : "Entry",
    note: e.note,
    today: true,
  }));
  let hist = HIST.get(t.id);
  if (!hist) {
    hist = [];
    const r = rng(seedOf("gate" + t.id));
    const u = UNIT_BY_ID.get(t.unitIds[0]);
    const gateIn = u?.kind === "climate" ? "Door D1" : u?.kind === "parking" ? "RV gate" : "Gate 1";
    const perWeek = t.business ? 4 + r() * 3 : t.name === "Matthew Okafor" ? 1.6 : t.name === "Sofia Reyes" ? 1.2 : 0.4 + r() * 1.8;
    const lockedSince = (() => {
      const e = ledgerFor(t).filter(x => x.kind === "info" && x.text === "Unit overlocked").pop();
      return u?.status === "overlocked" && e ? e.date : null;
    })();
    const habit = t.business ? 7 * 60 : r() < 0.5 ? 17 * 60 + 30 : 10 * 60;
    for (let d = 56; d >= 1; d--) {
      const date = addDays(TODAY, -d);
      if (date < t.moveIn) continue;
      const dow = new Date(date + "T12:00:00").getDay();
      const weekend = dow === 0 || dow === 6;
      const p = (perWeek / 7) * (weekend && !t.business ? 1.8 : 1);
      if (r() > p) continue;
      const start = Math.max(6 * 60 + 5, Math.min(21 * 60, habit + Math.floor((r() - 0.5) * 300)));
      if (lockedSince && date >= lockedSince) {
        hist.push({ date, min: start, gate: gateIn, kind: "Denied", note: "Code suspended · overlocked" });
        continue;
      }
      hist.push({ date, min: start, gate: gateIn, kind: "Entry" });
      hist.push({ date, min: start + 12 + Math.floor(r() * 70), gate: u?.kind === "drive-up" ? "Gate 2" : gateIn, kind: "Exit" });
    }
    if (t.name === "Matthew Okafor") hist.push({ date: "2026-10-01", min: 19 * 60 + 48, gate: "Gate 1", kind: "Denied", note: "Code suspended · overlocked" });
    HIST.set(t.id, hist);
  }
  return [...today, ...hist].sort((a, b) => (a.date === b.date ? b.min - a.min : a.date < b.date ? 1 : -1));
}

// ---- The agent's read on a tenant -------------------------------------------------------

export type StepAction = "pay" | "card" | "call" | "message" | "transfer" | "moveout" | "lien" | "callAlt" | "plan" | "rates" | "lock";
export interface Read { lines: string[]; steps: { text: string; action: StepAction; label: string }[] }

export function readFor(t: Tenant): Read {
  const unit = t.unitIds[0];
  const u = UNIT_BY_ID.get(unit);
  const life = lifetime(t);
  const locked = u?.status === "overlocked";
  const touch = lastTouch(t);
  const paidToday = ledgerFor(t).filter(e => e.kind === "payment" && e.date === TODAY && e.live).pop();
  const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

  if (paidToday && t.balance <= 0) {
    return {
      lines: [
        `${t.first} paid ${money(-paidToday.amount)} today (${(paidToday.method ?? "").split(" ·")[0].toLowerCase()}). ${unit} is ${u?.status === "overlocked" ? "still overlocked" : "unlocked"} and the balance is clear.`,
        t.autopay ? `Autopay is on, so the ${shortDate(nextBillDate(t))} charge will go through on its own.` : `Autopay is still off. The ${shortDate(nextBillDate(t))} charge will need another manual payment unless a card goes on file.`,
      ],
      steps: t.autopay ? [] : [{ text: "Get a card on file so next month doesn't repeat", action: "card", label: "Text autopay link" }],
    };
  }

  switch (t.name) {
    case "Matthew Okafor":
      return {
        lines: [
          `Matthew has rented A-122 since March 2024. He pays at the counter, mostly in cash and a few days late: ${life.lateCount} late fees in ${life.payments} payments. His only card expired in August.`,
          `He's ${t.daysLate} days past due on September (${money(t.balance)} with the late fee) and A-122 was overlocked on Sep 30. On Tuesday's call he promised to bring cash today.`,
        ],
        steps: [
          { text: `Take ${money(t.balance)} at the counter and remove the overlock`, action: "pay", label: "Take payment" },
          { text: "Text him an autopay link once he's paid", action: "card", label: "Draft text" },
          { text: "Hold lien steps until after today's visit", action: "plan", label: "Ask Zonera" },
        ],
      };
    case "Dana Whitfield":
      return {
        lines: [
          `Dana has rented A-131 since August 2023 and paid late ${life.lateCount} times. She's ${t.daysLate} days past due (${money(t.balance)}: two months of rent and two late fees), and A-131 has been overlocked since Aug 31.`,
          "Mail to her address came back on Sep 14 and Tuesday's call went to voicemail. She's past the 14-day mark for a preliminary lien notice (Bus. & Prof. Code §21703); a draft is ready for your approval.",
        ],
        steps: [
          { text: "Approve the preliminary lien notice (certified mail + email)", action: "lien", label: "Review notice" },
          { text: "Call the alternate contact, Marcus Whitfield", action: "callAlt", label: "Call Marcus" },
          { text: "Offer a two-part payment plan before the notice goes out", action: "plan", label: "Ask Zonera" },
        ],
      };
    case "Grace Lindqvist":
      return {
        lines: [
          "Grace has paid by autopay every month for 23 months. This month's charge failed on Sep 23 because her card expired; she replied that she'd update it over the weekend.",
          "The agent held the $45 late fee and resent the link this morning. If the card isn't updated by Monday, a short call usually closes it.",
        ],
        steps: [
          { text: "Resend the card update link", action: "card", label: "Draft text" },
          { text: "Call Grace to update the card by phone", action: "call", label: "Call" },
        ],
      };
    case "Sofia Reyes":
      return {
        lines: [
          "Sofia is a reliable autopay tenant in C-108 (5×10) since November 2025. On Monday she called about a bigger unit because her partner is moving in.",
          "C-117, a 10×10 two doors down, is held for her until Saturday's 10 am visit. Transferring adds $85/mo with no admin fee.",
        ],
        steps: [
          { text: "Prepare the transfer to C-117 so it's ready to sign Saturday", action: "transfer", label: "Start transfer" },
          { text: "Text a reminder for Saturday's visit", action: "message", label: "Draft text" },
        ],
      };
    case "Matthew Alvarez":
      return {
        lines: [
          "Matthew Alvarez pays by autopay and has never been late. This morning's $249 autopay went through at 9:17 and he came in through Gate 1 at 9:31.",
          "Not the Matthew who's past due: that's Matthew Okafor in A-122.",
        ],
        steps: [],
      };
    case "Matthew Cho":
      return {
        lines: ["Matthew Cho moved into D-207 in January and pays by autopay. No balance, no open requests. He was in at 8:30 this morning.", "His rent becomes eligible for a rate review in January, after 12 months."],
        steps: [],
      };
    case "Ben Carter":
      return {
        lines: [
          "Ben is moving out. He gave notice on Sep 18 and is prepaid through Oct 31. The move-out inspection is today at 3:30 pm.",
          "Once it passes, B-141 can be re-listed at the $249 street rate. There's one reservation for a 10×15 (Imani Mensah, moving Oct 8).",
        ],
        steps: [{ text: "Run the move-out: inspection, final statement, re-list", action: "moveout", label: "Ask Zonera" }],
      };
  }

  const street = u?.rate ?? t.rent;
  const gap = (t.rent - (t.protection ? [0, 12, 19, 29][[0, 2000, 5000, 10000].indexOf(t.protection)] : 0)) - street;
  const tenure = Math.max(1, Math.round((new Date(TODAY).getTime() - new Date(t.moveIn).getTime()) / (30.44 * 86400000)));
  if (t.daysLate > 0) {
    const lines = [
      `${t.first} is ${t.daysLate} days past due on ${unit} (${money(t.balance)}).${locked ? " The unit is overlocked." : ""} ${t.autopay ? "Autopay failed on the due date, most likely an expired or declined card." : "Pays manually."}`,
      `Last contact: ${touch ? `${shortDate(touch.date)}, ${touch.channel === "call" ? "AI call" : touch.channel.toUpperCase() === "SMS" ? "SMS" : touch.channel}${touch.call ? ` (${touch.call.outcome.toLowerCase()})` : ""}` : "none on file"}. ${life.lateCount > 2 ? `${life.lateCount} late fees over ${tenure} months.` : "Usually pays on time."}${t.daysLate >= 14 ? " Eligible for a preliminary lien notice." : ""}`,
    ];
    return {
      lines,
      steps: [
        { text: t.autopay ? "Send a card update link" : "Send a payment reminder", action: t.autopay ? "card" : "message", label: "Draft text" },
        { text: "Have Zonera Voice call about the balance", action: "call", label: "Call" },
        ...(locked ? [] : t.daysLate >= 15 ? [{ text: "Overlock the unit per policy (15+ days)", action: "lock" as StepAction, label: "Overlock" }] : []),
      ],
    };
  }
  const mo = MOVE_OUTS.get(t.id);
  return {
    lines: [
      `${t.first} has rented ${unit} for ${tenure} months and pays ${t.autopay ? `by autopay (${t.card})` : "manually"}${life.lateCount ? `, with ${life.lateCount} late fee${life.lateCount > 1 ? "s" : ""} on record` : ", never late"}.${mo ? ` Moving out ${longDate(mo.date)}.` : ""}`,
      gap < -8 ? `Rent is ${money(-gap)} below today's street rate for a ${u?.size.replace("x", "×")}.${tenure >= 12 ? " Eligible for the next rate review." : ""}` : "Rent is in line with street rate. Nothing needs attention.",
    ],
    steps: gap < -8 && tenure >= 12 ? [{ text: "Include in the next rate review", action: "rates", label: "Open rates" }] : [],
  };
}

export function documentsFor(t: Tenant) {
  const docs: { id: string; title: string; meta: string; kind: "lease" | "addendum" | "id" | "notice" | "receipt" | "photo"; size: string; restricted?: boolean }[] = [];
  docs.push({ id: "lease", title: "Rental agreement", meta: `Signed ${longDate(t.moveIn)} · e-sign certificate attached`, kind: "lease", size: "184 KB" });
  docs.push({ id: "prot", title: t.protection ? "Tenant protection addendum" : "Protection waiver", meta: `Signed ${longDate(t.moveIn)}`, kind: "addendum", size: "62 KB" });
  if (t.autopay) docs.push({ id: "ach", title: "Autopay authorization", meta: `${t.card} · signed ${longDate(t.moveIn)}`, kind: "addendum", size: "38 KB" });
  docs.push({ id: "id", title: "Photo ID", meta: "CA driver license · verified by Persona", kind: "id", size: "1.2 MB", restricted: true });
  docs.push({ id: "photos", title: "Move-in photos", meta: `3 photos · ${t.unitIds[0]} · ${longDate(t.moveIn)}`, kind: "photo", size: "6.8 MB" });
  for (const e of ledgerFor(t)) {
    if (e.kind === "info" && e.text === "Rent change notice sent") docs.push({ id: "rc" + e.date, title: "Rent change notice", meta: `${e.detail?.split(" · ")[0]} · delivered ${longDate(e.date)}`, kind: "notice", size: "41 KB" });
    if (e.kind === "info" && e.text === "Unit overlocked") docs.push({ id: "ol" + e.date, title: "Overlock notice", meta: `Delivered ${longDate(e.date)} · SMS and email`, kind: "notice", size: "29 KB" });
  }
  if (t.name === "Dana Whitfield") docs.push({ id: "lien", title: "Preliminary lien notice · draft", meta: "Bus. & Prof. Code §21703 · includes blank Declaration in Opposition", kind: "notice", size: "96 KB" });
  if (MOVE_OUTS.has(t.id)) docs.push({ id: "mo", title: "Notice to vacate", meta: `Received ${longDate(MOVE_OUTS.get(t.id)!.notice)}`, kind: "notice", size: "22 KB" });
  const lastPay = ledgerFor(t).filter(e => e.kind === "payment").pop();
  if (lastPay) docs.push({ id: "rcpt", title: `Receipt ${lastPay.ref ?? ""}`, meta: `$${(-lastPay.amount).toFixed(2)} · ${longDate(lastPay.date)}`, kind: "receipt", size: "18 KB" });
  return docs.reverse().sort((a, b) => (a.kind === "lease" ? -1 : b.kind === "lease" ? 1 : 0));
}

export function lastContactLabel(t: Tenant) {
  const c = lastTouch(t);
  if (!c) return t.lastContact ?? "—";
  const what = c.channel === "call" ? (c.dir === "in" ? "Call in" : "AI call") : c.channel === "sms" ? (c.dir === "in" ? "SMS in" : "SMS") : c.channel === "email" ? "Email" : c.channel === "note" ? "Note" : c.channel === "letter" ? "Letter" : "Event";
  return `${shortDate(c.date)} · ${what}`;
}

export function commsCount(t: Tenant) {
  return commsFor(t).length;
}

export const ALL_TENANTS = () => TENANTS;
