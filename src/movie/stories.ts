import { go, nav } from "../state/store";
import { callById, liveCalls, openCall, ringNow, startLiveCalls } from "../calls/engine";
import { DANA } from "../calls/scripts";
import type { Chapter, Story } from "./director";

// The film: one Friday morning at Zonera Alder Lake, told across the operator
// dashboard, agent mode and the call center. Every chapter also works on its
// own (for re-shooting one scene): chips fall back to typing the prompt.

const film: Chapter[] = [
  {
    id: "storefront",
    kicker: "9:41 am · Storefront",
    title: "Maya rents a unit from her phone",
    body: "She types what she's storing. Zonera sizes it, shows her exact unit in 3D, checks her ID, takes payment and hands her a gate code with the route to her door.",
    async beats(d) {
      go("store");
      await d.until(() => nav.route === "store/access", 150000);
      await d.wait(9000);
    },
  },
  {
    id: "open",
    kicker: "9:44 am · Operator dashboard",
    title: "One manager, 412 units",
    body: "Priya runs Zonera Alder Lake on her own. Maya's rental is already on the books, and the agent has been answering calls and chasing payments since 6 am.",
    async beats(d) {
      if (nav.route !== "ops/overview") go("ops/overview");
      await d.wait(1400);
      await d.point(".ok-stat");
      await d.wait(1600);
      await d.point(".ov-brief-h");
      await d.wait(2200);
      await d.scroll(".ov-grid--charts", "start");
      await d.wait(1800);
      await d.scroll(".ov-brief", "start");
      await d.wait(600);
    },
  },
  {
    id: "payment",
    kicker: "Agent mode",
    title: "Matthew pays cash",
    body: "She says what happened. Zonera picks the right Matthew from three, checks the ledger, records the cash and lifts the overlock.",
    async beats(d) {
      const text = "Matthew came in and paid $240 cash";
      if (nav.route === "ops/overview" && (await d.click("text:.ov-brief-list button|Take payment", { optional: true }))) await d.settle(text);
      else await d.ask(text, { newTab: true });
    },
  },
  {
    id: "walkin",
    kicker: "Agent mode · same chat",
    title: "A walk-in at the counter",
    body: "Unit on the 3D map, protection, card reader, lease and gate code, all in one thread. Nothing to learn.",
    async beats(d) {
      await d.ask("New customer wants a 10×10 today, Jordan Lee");
    },
  },
  {
    id: "batch",
    kicker: "Agent mode · same chat",
    title: "Three move-ins, one sentence",
    body: "Reservations become tenants in parallel: units assigned, leases signed, codes texted. Each step can be undone.",
    async beats(d) {
      await d.ask("Move these three reservations in today: Owen Murphy, Hana Sato, Imani Mensah");
    },
  },
  {
    id: "gate",
    kicker: "Agent mode · new tab",
    title: "A vendor at the gate",
    body: "Separate work gets its own tab. A one-time code for only the doors he needs, expiring at 5 pm on its own.",
    async beats(d) {
      await d.ask("Make a gate code for the HVAC tech, 1–5pm today, Building D only", { newTab: true });
    },
  },
  {
    id: "collections",
    kicker: "Agent mode · new tab",
    title: "Collections without the chasing",
    body: "Zonera drafts the plan, Priya approves it once, and it runs: late fees, overlocks, notices and friendly reminders.",
    async beats(d) {
      await d.ask("Who's more than 15 days late?", { newTab: true });
      await d.chip("Text everyone past due a reminder");
    },
  },
  {
    id: "calls",
    kicker: "Call center",
    title: "Every call answered",
    body: "Zonera Voice is on three calls right now. Priya can listen in, whisper a hint, or take over at any point.",
    async beats(d) {
      startLiveCalls();
      await d.wait(600);
      await d.openCalls();
      await d.wait(1800);
      if (!(await d.callRow("Leila"))) await d.callRow(liveCalls()[0]?.name ?? "");
      // The call view plays a whisper on its own in movie mode.
      await d.wait(11000);
    },
  },
  {
    id: "dana",
    kicker: "Call center",
    title: "When it needs a person, it asks",
    body: "Dana got a lien letter while she was in the hospital. Zonera Voice calms her down, then brings Priya in: pausing a sale needs a manager.",
    async beats(d) {
      const id = ringNow("dana-lien");
      await d.wait(1600);
      // The ringing pill in the top bar jumps straight to the incoming call.
      if (!(await d.click(".cc-pill--ring", { optional: true })) && id) openCall(id);
      await d.until(() => {
        const c = callById(id);
        return DANA.resolved || !c || c.status === "ended" || c.status === "wrap";
      }, 150000);
      await d.wait(5000);
    },
  },
  {
    id: "sync",
    kicker: "Operator dashboard",
    title: "Everything stays in sync",
    body: "Every action landed everywhere: the digital twin, Dana's file, the rent roll and the activity log. No double entry.",
    async beats(d) {
      await d.closeCalls();
      await d.page("facility");
      await d.wait(4200);
      await d.page("tenants", "ops/tenants/T-1004");
      if (nav.route !== "ops/tenants/T-1004") go("ops/tenants/T-1004");
      await d.wait(4200);
      await d.page("overview");
      await d.scroll(".ov-feed", "center");
      await d.point(".ov-feed li");
      await d.wait(3000);
    },
  },
  {
    id: "report",
    kicker: "Agent mode",
    title: "Month end in one sentence",
    body: "The owner report, written and charted from live data, ready to send.",
    async beats(d) {
      await d.ask("Generate the September owner report vs last year", { newTab: true });
    },
  },
];

export const FILM: Story = {
  id: "friday",
  kind: "film",
  title: "A Friday at Alder Lake",
  sub: "Storefront, dashboard, agent and call center · about 7 minutes",
  chapters: film,
  end: { title: "zonera", body: "The agent-native platform for self-storage." },
};

// ---------------------------------------------------------------- agent chains
// Several flows in one chat. Each step presses the matching next-step chip
// when it's there, so the thread reads like a real conversation.

function chain(id: string, title: string, sub: string, steps: { title: string; text: string; body: string }[]): Story {
  return {
    id,
    kind: "chain",
    title,
    sub,
    chapters: steps.map((s, i) => ({
      id: `${id}-${i}`,
      kicker: title,
      title: s.title,
      body: s.body,
      beats: d => (i === 0 ? d.ask(s.text, { newTab: true }) : d.chip(s.text)),
    })),
  };
}

export const CHAINS: Story[] = [
  chain("frontdesk", "Front desk rush", "Payment, walk-in and three move-ins", [
    { title: "Take a payment", text: "Matthew came in and paid $240 cash", body: "Which Matthew? The $240 matches one balance exactly." },
    { title: "Walk-in move-in", text: "New customer wants a 10×10 today, Jordan Lee", body: "Unit, protection, payment and lease in one thread." },
    { title: "Batch move-ins", text: "Move these three reservations in today: Owen Murphy, Hana Sato, Imani Mensah", body: "Three reservations become tenants in parallel." },
  ]),
  chain("collections", "Collections day", "Aging, the sweep and a lien", [
    { title: "Delinquency aging", text: "Show delinquency aging", body: "Who owes what, by bucket, from live balances." },
    { title: "The sweep", text: "Who's more than 15 days late?", body: "Late fees, overlocks and notices, approved once." },
    { title: "Start a lien", text: "Start the lien process for Dana Whitfield", body: "California timeline, notices scheduled, sale date set." },
  ]),
  chain("vendor", "Vendor visit", "Code, gate log, revoke", [
    { title: "One-time gate code", text: "Make a gate code for the HVAC tech, 1–5pm today, Building D only", body: "Only the doors he needs, only for the visit." },
    { title: "Gate log", text: "Who came in after 10pm last night?", body: "Every entry and denial, with the person behind each code." },
    { title: "Revoke early", text: "Revoke the HVAC tech's code at 5pm", body: "Access ends exactly when the job does." },
  ]),
  chain("growth", "Fill the 10×20s", "Revenue mix, a promo, an email", [
    { title: "Revenue by size", text: "Break revenue down by unit size", body: "Which sizes earn and which sit empty." },
    { title: "Launch a promo", text: "Run a $1 first month on 10×20s until we hit 90%", body: "Published to the storefront, ends on its own." },
    { title: "Tell the tenants", text: "Send a promo email to 10×20 tenants tomorrow", body: "Drafted, personalised and scheduled." },
  ]),
  chain("monthend", "Month end", "Report, schedule, rate review", [
    { title: "Owner report", text: "Generate the September owner report vs last year", body: "Charts and narrative from live data." },
    { title: "Put it on a schedule", text: "Schedule it monthly", body: "It goes out by itself from now on." },
    { title: "Rate review", text: "Raise rates 6% for tenants here over a year", body: "Who qualifies, the impact, and 30-day notices." },
  ]),
  chain("sofia", "Sofia upsizes", "Look up, transfer, confirm", [
    { title: "Pull up the tenant", text: "Pull up Sofia Reyes", body: "Account, ledger, gate log and notes at a glance." },
    { title: "Transfer units", text: "Move Sofia Reyes from her 5×10 to a 10×10", body: "Prorated, addendum signed, gate profile updated." },
    { title: "What's left", text: "How many 10×10s are free?", body: "Availability updates the moment she moves." },
  ]),
];

export const STORIES = [FILM, ...CHAINS];
export const storyById = (id: string) => STORIES.find(s => s.id === id);
