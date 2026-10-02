import { TENANTS, type Tenant } from "./tenants";
import { UNIT_BY_ID } from "./facility";
import { TODAY, addDays, billingDay, clockMin, rng, seedOf } from "./ledger";

// Communications per tenant: SMS, email, AI voice calls, letters, staff notes and
// system events. The story cast has hand-written threads; everyone else gets a
// plausible history from their rent-roll state. Live sends append to LIVE.

export type Channel = "sms" | "email" | "call" | "note" | "letter" | "system";
export type Sentiment = "positive" | "neutral" | "negative";

export interface CallInfo {
  duration: string;
  outcome: string;
  sentiment: Sentiment;
  summary: string;
  transcript?: { who: "agent" | "caller"; text: string }[];
}

export interface Comm {
  id: string;
  tenantId: string;
  date: string; // ISO
  min: number;
  channel: Channel;
  dir?: "in" | "out";
  who: string;
  subject?: string;
  body: string;
  status?: string;
  call?: CallInfo;
  live?: boolean;
}

type Seed = Omit<Comm, "id" | "tenantId">;
const m = (h: number, mm: number) => h * 60 + mm;

const STORY: Record<string, Seed[]> = {
  "Matthew Okafor": [
    { date: "2024-03-14", min: m(10, 21), channel: "email", dir: "out", who: "Zonera agent", subject: "Welcome to Zonera Alder Lake", body: "Your unit is A-122, a 10×10 drive-up on the north side of Building A. The gate is open 6:00 am – 10:00 pm every day, and your personal gate code is in the Zonera app.", status: "Opened" },
    { date: "2026-08-03", min: m(10, 0), channel: "email", dir: "out", who: "Zonera agent", subject: "Your card on file expires this month", body: "The Visa ending 3310 on your account expires 08/26. Update it in two taps at zonera.co/u/a122 so rent keeps going through.", status: "Opened" },
    { date: "2026-08-25", min: m(16, 51), channel: "note", who: "Priya Raman", body: "Paid $240 cash at the counter (August rent + late fee). Says his new debit card should arrive next month." },
    { date: "2026-09-14", min: m(8, 0), channel: "sms", dir: "out", who: "Zonera agent", body: "Hi Matthew, rent for A-122 ($195) is due today. Pay at zonera.co/p/a122 or at the office, 9–6 Mon–Sat.", status: "Delivered" },
    { date: "2026-09-20", min: m(9, 0), channel: "sms", dir: "out", who: "Zonera agent", body: "Rent for A-122 is now 6 days late and a $45 late fee was added. Your balance is $240. Reply PLAN if you need more time.", status: "Delivered" },
    { date: "2026-09-20", min: m(12, 41), channel: "sms", dir: "in", who: "Matthew", body: "Got paid late this month. I'll come by with cash next week." },
    { date: "2026-09-20", min: m(12, 42), channel: "sms", dir: "out", who: "Zonera agent", body: "Thanks, Matthew, noted. The office is open 9–6 Mon–Sat and the balance is $240.", status: "Delivered" },
    { date: "2026-09-24", min: m(10, 0), channel: "sms", dir: "out", who: "Zonera agent", body: "Reminder: $240 is past due on A-122. Under your rental agreement the unit will be overlocked on Sep 30 if it's still unpaid.", status: "Delivered" },
    {
      date: "2026-09-29", min: m(17, 12), channel: "call", dir: "out", who: "Zonera Voice", body: "Payment reminder call",
      call: {
        duration: "2:14", outcome: "Promise to pay · Fri Oct 2", sentiment: "neutral",
        summary: "Matthew confirmed he'll pay $240 in cash at the office on Friday, Oct 2. He understands A-122 will be overlocked tomorrow until he pays. He asked about autopay on a new debit card; the agent will text the link after he pays.",
        transcript: [
          { who: "agent", text: "Hi Matthew, this is Zonera calling for Alder Lake Storage about unit A-122. Is now an OK time?" },
          { who: "caller", text: "Yeah, go ahead. Is this about the rent?" },
          { who: "agent", text: "It is. The balance is $240, which includes a $45 late fee. The unit is scheduled to be overlocked tomorrow if it's still open." },
          { who: "caller", text: "I get paid Thursday. I can bring cash Friday morning." },
          { who: "agent", text: "That works. I've noted Friday, October 2. Once it's paid, the overlock comes off right away and your gate code works again." },
          { who: "caller", text: "OK. Can I put a new card on autopay so this doesn't keep happening?" },
          { who: "agent", text: "Yes. I'll text you a secure link after Friday's payment. It takes about a minute." },
        ],
      },
    },
    { date: "2026-09-30", min: m(10, 12), channel: "system", who: "Priya Raman", body: "A-122 overlocked · gate code suspended until paid" },
    { date: "2026-09-30", min: m(10, 13), channel: "sms", dir: "out", who: "Zonera agent", body: "A-122 has been overlocked and your gate code is paused. Pay $240 online or at the office to restore access right away.", status: "Delivered" },
    { date: "2026-10-01", min: m(16, 5), channel: "note", who: "Priya Raman", body: "He called the office. Coming in Friday morning with cash. Hold any lien steps until then." },
  ],
  "Dana Whitfield": [
    { date: "2023-08-21", min: m(11, 40), channel: "email", dir: "out", who: "Zonera agent", subject: "Welcome to Zonera Alder Lake", body: "Your unit is A-131, a 10×10 drive-up in Building A. Gate hours are 6:00 am – 10:00 pm.", status: "Opened" },
    { date: "2026-08-16", min: m(8, 0), channel: "sms", dir: "out", who: "Zonera agent", body: "Hi Dana, rent for A-131 ($179) is due today. Pay at zonera.co/p/a131.", status: "Delivered" },
    { date: "2026-08-22", min: m(9, 0), channel: "sms", dir: "out", who: "Zonera agent", body: "Rent for A-131 is 6 days late and a $45 late fee was added. Balance: $224.", status: "Delivered" },
    { date: "2026-08-28", min: m(9, 30), channel: "email", dir: "out", who: "Zonera agent", subject: "Your account is past due", body: "Your balance on A-131 is $224. Reply to this email or call (530) 555-0142 if you'd like to set up a payment plan.", status: "Delivered, not opened" },
    { date: "2026-08-31", min: m(10, 12), channel: "system", who: "Zonera agent", body: "A-131 overlocked · gate code suspended until paid" },
    { date: "2026-09-03", min: m(11, 0), channel: "letter", dir: "out", who: "Zonera agent", subject: "Past-due notice · first-class mail", body: "Mailed to 418 Pine St, Apt 3, South Lake Tahoe, CA 96150.", status: "Returned Sep 14 · not at this address" },
    { date: "2026-09-16", min: m(8, 0), channel: "sms", dir: "out", who: "Zonera agent", body: "Dana, September rent for A-131 is due today and August is still open. Total due: $403.", status: "Delivered" },
    { date: "2026-09-22", min: m(9, 0), channel: "sms", dir: "out", who: "Zonera agent", body: "A second $45 late fee was added to A-131. Balance: $448. Please call us; we can set up a plan.", status: "Delivered" },
    { date: "2026-09-25", min: m(10, 30), channel: "letter", dir: "out", who: "Zonera agent", subject: "Courtesy notice · alternate contact", body: "Sent to the alternate contact on the rental agreement, Marcus Whitfield, 77 Kiva Rd, Meyers, CA 96150.", status: "Mailed" },
    {
      date: "2026-09-30", min: m(11, 2), channel: "call", dir: "out", who: "Zonera Voice", body: "Past-due call",
      call: {
        duration: "0:48", outcome: "No answer · voicemail left", sentiment: "neutral",
        summary: "No answer. Left a voicemail asking Dana to call the office about A-131 and the $448 balance, and mentioning that a payment plan is available. The number rang through, so it is still in service.",
      },
    },
    { date: "2026-10-01", min: m(9, 15), channel: "system", who: "Zonera agent", body: "Preliminary lien notice drafted under Bus. & Prof. Code §21703 · waiting for your approval" },
  ],
  "Grace Lindqvist": [
    { date: "2024-10-30", min: m(13, 5), channel: "email", dir: "out", who: "Zonera agent", subject: "Welcome to Zonera Alder Lake", body: "Your unit is D-118, a climate-controlled unit on floor 1 of Building D. Use your gate code at the Building D door too.", status: "Opened" },
    { date: "2026-09-23", min: m(6, 5), channel: "system", who: "Payments", body: "Autopay declined · Visa •• 0077 · card expired 09/26" },
    { date: "2026-09-23", min: m(8, 0), channel: "sms", dir: "out", who: "Zonera agent", body: "Hi Grace, this month's autopay for D-118 ($219) didn't go through because the card ending 0077 has expired. Update it here and we'll retry: zonera.co/u/d118", status: "Delivered" },
    { date: "2026-09-23", min: m(8, 0), channel: "email", dir: "out", who: "Zonera agent", subject: "Your autopay didn't go through", body: "The card ending 0077 expired, so we couldn't collect $219 for D-118. Update your card at zonera.co/u/d118 and we'll retry right away.", status: "Opened" },
    { date: "2026-09-26", min: m(19, 20), channel: "sms", dir: "in", who: "Grace", body: "Oh no, thanks for the heads up. Will update it this weekend." },
    { date: "2026-09-29", min: m(8, 40), channel: "note", who: "Zonera agent", body: "Held the $45 late fee: first decline in 23 months and she replied within three days. Will retry the card as soon as she updates it." },
    { date: "2026-10-02", min: m(9, 38), channel: "sms", dir: "out", who: "Zonera agent", body: "Quick reminder: the D-118 balance is $219. Update your card at zonera.co/u/d118 and we'll retry right away.", status: "Delivered" },
  ],
  "Sofia Reyes": [
    { date: "2025-11-08", min: m(15, 30), channel: "email", dir: "out", who: "Zonera agent", subject: "Welcome to Zonera Alder Lake", body: "Your unit is C-108, a 5×10 drive-up in Building C.", status: "Opened" },
    {
      date: "2026-09-29", min: m(14, 6), channel: "call", dir: "in", who: "Zonera Voice", body: "Inbound call · bigger unit",
      call: {
        duration: "3:41", outcome: "Transfer interest · visit booked Sat 10 am", sentiment: "positive",
        summary: "Sofia is moving in with her partner and needs more space by mid-October. The agent suggested C-117, a 10×10 two doors down, at $189/mo with no admin fee for a transfer. She'll look at it Saturday at 10 am; C-117 is held until then.",
        transcript: [
          { who: "agent", text: "Thanks for calling Zonera Alder Lake, this is the Zonera assistant. How can I help?" },
          { who: "caller", text: "Hi, I rent C-108. I think I need something bigger, my partner is moving in." },
          { who: "agent", text: "Congratulations. Roughly what's coming: a one-bedroom's worth of furniture plus boxes?" },
          { who: "caller", text: "Yeah, a couch, a bed frame, a dresser and maybe twenty boxes on top of what's there." },
          { who: "agent", text: "A 10×10 fits that comfortably. C-117 is two doors down from you, drive-up, $189 a month. Transfers have no admin fee." },
          { who: "caller", text: "Oh nice. Can I see it this weekend?" },
          { who: "agent", text: "Saturday at 10 works. I'll hold C-117 for you until then and text you the details." },
        ],
      },
    },
    { date: "2026-09-29", min: m(14, 11), channel: "sms", dir: "out", who: "Zonera agent", body: "Here's C-117, the 10×10 two doors down: $189/mo, drive-up, no admin fee for a transfer. It's held for you until Saturday. Reply YES to confirm the 10 am visit.", status: "Delivered" },
    { date: "2026-09-29", min: m(14, 20), channel: "sms", dir: "in", who: "Sofia", body: "YES, see you Saturday" },
    { date: "2026-09-29", min: m(14, 21), channel: "note", who: "Zonera agent", body: "Upsize opportunity, +$85/mo. Visit Sat Oct 3, 10 am. C-117 on hold until then." },
  ],
  "Matthew Alvarez": [
    { date: "2025-06-02", min: m(12, 10), channel: "email", dir: "out", who: "Zonera agent", subject: "Welcome to Zonera Alder Lake", body: "Your unit is B-122, a 10×15 drive-up in Building B. Autopay is on with your Visa ending 4242.", status: "Opened" },
    {
      date: "2026-08-11", min: m(18, 2), channel: "call", dir: "in", who: "Zonera Voice", body: "Inbound call · access hours",
      call: {
        duration: "1:26", outcome: "Answered · no follow-up", sentiment: "positive",
        summary: "Asked whether he could get in at 5:30 am for a contractor pickup. The agent explained gate hours (6:00 am – 10:00 pm) and offered a one-time early code; he said 6 am works.",
      },
    },
    { date: "2026-09-02", min: m(9, 6), channel: "email", dir: "out", who: "Zonera agent", subject: "Receipt · $249.00 autopay", body: "Thanks, Matthew. We collected $249.00 for B-122 (Sep 2 – Oct 1) from your Visa ending 4242.", status: "Delivered" },
    { date: "2026-10-02", min: m(9, 17), channel: "email", dir: "out", who: "Zonera agent", subject: "Receipt · $249.00 autopay", body: "Thanks, Matthew. We collected $249.00 for B-122 (Oct 2 – Nov 1) from your Visa ending 4242.", status: "Delivered" },
  ],
  "Matthew Cho": [
    { date: "2026-01-19", min: m(11, 15), channel: "email", dir: "out", who: "Zonera agent", subject: "Welcome to Zonera Alder Lake", body: "Your unit is D-207, a climate-controlled unit on floor 2 of Building D. Take the elevator up; it's down the hall on your left.", status: "Opened" },
    { date: "2026-06-03", min: m(20, 14), channel: "sms", dir: "in", who: "Matthew", body: "Is it OK to keep a road bike and some wine in the climate unit?" },
    { date: "2026-06-03", min: m(20, 14), channel: "sms", dir: "out", who: "Zonera agent", body: "The bike is fine. Building D holds 62–66°F, which suits wine for short-term storage, but perishables and alcohol for resale aren't allowed under the rental agreement.", status: "Delivered" },
    { date: "2026-09-19", min: m(7, 3), channel: "email", dir: "out", who: "Zonera agent", subject: "Receipt · $129.00 autopay", body: "We collected $129.00 for D-207 from your Amex ending 1005.", status: "Delivered" },
  ],
  "Ben Carter": [
    { date: "2025-02-11", min: m(10, 50), channel: "email", dir: "out", who: "Zonera agent", subject: "Welcome to Zonera Alder Lake", body: "Your unit is B-141, a 10×15 drive-up in Building B.", status: "Opened" },
    { date: "2026-09-18", min: m(21, 4), channel: "email", dir: "in", who: "Ben", subject: "Moving out end of October", body: "Hi, I'm moving to Sacramento and will be out of B-141 by the end of October. Can I do the inspection early? I'll be cleared out by Oct 2." },
    { date: "2026-09-18", min: m(21, 5), channel: "email", dir: "out", who: "Zonera agent", subject: "Re: Moving out end of October", body: "Thanks, Ben. You're prepaid through Oct 31. I've booked the move-out inspection for Friday, Oct 2 at 3:30 pm. Leave the unit broom-clean and remove your lock; we'll email the final statement the same day.", status: "Opened" },
    { date: "2026-10-01", min: m(10, 0), channel: "sms", dir: "out", who: "Zonera agent", body: "Reminder: your B-141 move-out inspection is tomorrow at 3:30 pm. Reply if you need a different time.", status: "Delivered" },
    { date: "2026-10-01", min: m(10, 22), channel: "sms", dir: "in", who: "Ben", body: "Perfect, thanks. Will be there." },
  ],
};

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function isoFromLabel(label: string) {
  const mm = /^(\w{3}) (\d+)/.exec(label);
  if (!mm) return TODAY;
  return `2026-${String(MON.indexOf(mm[1]) + 1).padStart(2, "0")}-${mm[2].padStart(2, "0")}`;
}

function generic(t: Tenant): Seed[] {
  const r = rng(seedOf("comm" + t.id));
  const u = UNIT_BY_ID.get(t.unitIds[0]);
  const unit = t.unitIds[0];
  const out: Seed[] = [
    { date: t.moveIn, min: m(10, 0) + Math.floor(r() * 400), channel: "email", dir: "out", who: "Zonera agent", subject: "Welcome to Zonera Alder Lake", body: `Your unit is ${unit}${u ? `, a ${u.size.replace("x", "×")} ${u.kind === "climate" ? "climate-controlled unit" : u.kind === "parking" ? "RV and boat space" : "drive-up"}` : ""}. Gate hours are 6:00 am – 10:00 pm.`, status: "Opened" },
  ];
  if (r() < 0.35) {
    const d = addDays(TODAY, -20 - Math.floor(r() * 120));
    if (d > t.moveIn) {
      const q = [
        ["Can I add my partner to the gate access?", "Yes. Reply with their name and phone number and I'll add them to your account; they'll get their own code."],
        ["Do you sell boxes at the office?", "We do: small, medium and large boxes, tape and locks, at the office 9–6 Mon–Sat."],
        ["What's the gate code again?", "Your code is in the Zonera app under Access. For security I can't text it, but I can resend the app link."],
        ["Is there a cart I can borrow?", "There are four flatbed carts by the office and two at the Building D entrance. Just bring them back to the rack."],
      ][Math.floor(r() * 4)];
      out.push({ date: d, min: m(18, 0) + Math.floor(r() * 120), channel: "sms", dir: "in", who: t.first, body: q[0] });
      out.push({ date: d, min: m(18, 1) + Math.floor(r() * 120), channel: "sms", dir: "out", who: "Zonera agent", body: q[1], status: "Delivered" });
    }
  }
  if (t.daysLate > 0) {
    const due = addDays(TODAY, -t.daysLate);
    out.push({ date: due, min: m(8, 0), channel: "sms", dir: "out", who: "Zonera agent", body: `Hi ${t.first}, rent for ${unit} ($${t.rent}) is due today. Pay at zonera.co/p/${unit.toLowerCase().replace("-", "")}.`, status: "Delivered" });
    if (t.daysLate > 5) out.push({ date: addDays(due, 6), min: m(9, 0), channel: "sms", dir: "out", who: "Zonera agent", body: `Rent for ${unit} is 6 days late and a $45 late fee was added.`, status: "Delivered" });
    if (t.lastContact) {
      const d = isoFromLabel(t.lastContact);
      const kind = t.lastContact.split("· ")[1] ?? "";
      if (/Call/.test(kind)) {
        out.push({ date: d, min: m(11, 0) + Math.floor(r() * 200), channel: "call", dir: "out", who: "Zonera Voice", body: "Past-due call", call: { duration: "0:" + String(30 + Math.floor(r() * 29)), outcome: "No answer · voicemail left", sentiment: "neutral", summary: `No answer. Left a voicemail about the ${unit} balance and the payment link.` } });
      } else if (/Email/.test(kind)) {
        out.push({ date: d, min: m(9, 30), channel: "email", dir: "out", who: "Zonera agent", subject: "Your account is past due", body: `Your balance on ${unit} is $${t.balance}. Pay online or reply to set up a plan.`, status: "Opened" });
      } else {
        out.push({ date: d, min: m(10, 0), channel: "sms", dir: "out", who: "Zonera agent", body: `Reminder: $${t.balance} is past due on ${unit}. Pay at the link above or at the office.`, status: "Delivered" });
      }
    }
    if (UNIT_BY_ID.get(unit)?.status === "overlocked") out.push({ date: addDays(due, 15), min: m(10, 12), channel: "system", who: "Zonera agent", body: `${unit} overlocked · gate code suspended until paid` });
  } else if (t.autopay && t.card) {
    const d = addDays(TODAY, -((31 + 2 - billingDay(t)) % 31) || 0);
    if (d > t.moveIn && d <= TODAY) out.push({ date: d, min: m(7, 0) + Math.floor(r() * 120), channel: "email", dir: "out", who: "Zonera agent", subject: `Receipt · $${t.rent}.00 autopay`, body: `We collected $${t.rent}.00 for ${unit} from your ${t.card}.`, status: "Delivered" });
  }
  return out;
}

const BASE = new Map<string, Comm[]>();
const LIVE = new Map<string, Comm[]>();
let seq = 1;

export function commsFor(t: Tenant): Comm[] {
  let b = BASE.get(t.id);
  if (!b) {
    const seeds = STORY[t.name] ?? generic(t);
    b = seeds.map((s, i) => ({ ...s, id: `${t.id}-c${i}`, tenantId: t.id }));
    BASE.set(t.id, b);
  }
  return [...b, ...(LIVE.get(t.id) ?? [])].sort((a, z) => (a.date === z.date ? z.min - a.min : a.date < z.date ? 1 : -1));
}

/** Append a message, call, note or system event to a tenant's thread. */
export function addComm(tenantId: string, c: Omit<Comm, "id" | "tenantId" | "date" | "min" | "live"> & { date?: string; min?: number }) {
  const list = LIVE.get(tenantId) ?? [];
  const entry: Comm = { date: TODAY, min: clockMin(), ...c, id: `CL${seq++}`, tenantId, live: true };
  list.push(entry);
  LIVE.set(tenantId, list);
  return entry;
}

export function lastTouch(t: Tenant): Comm | undefined {
  return commsFor(t).find(c => c.channel !== "system");
}

export const CHANNEL_LABEL: Record<Channel, string> = { sms: "SMS", email: "Email", call: "Call", note: "Note", letter: "Letter", system: "System" };

export function allTenantsTouchedToday() {
  return TENANTS.filter(t => commsFor(t).some(c => c.date === TODAY));
}
