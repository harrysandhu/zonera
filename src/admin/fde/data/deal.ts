import type { Person, Source, Requirement, OwnerItem, Task, Mail, Exception } from "../types";

// The hero deal: Brennan Storage Co. moves three facilities off Keystone onto Zonera.
// Alder Lake (the facility in the operator demo) is the one we follow end to end.
//
// Story clock: onboarding starts when the second call ends, Wed Sep 30 at 6:12 pm,
// and cuts over Fri Oct 2 at 5:45 am, before the gate opens at 6:00 am. The operator
// demo picks up at 9:44 am the same morning: the facility's first day on Zonera.

export const DEAL = {
  id: "brennan",
  org: "Brennan Storage Co.",
  legal: "Brennan Storage Co. LLC",
  facility: "Alder Lake Self Storage",
  networkName: "Zonera Alder Lake",
  address: "2200 Shoreline Drive, Alder Lake, CA 96150",
  facilities: [
    { id: "alder-lake", name: "Alder Lake", units: 181, hero: true },
    { id: "dolores", name: "Dolores", units: 184 },
    { id: "pier-7", name: "Pier 7", units: 96 },
  ],
  legacy: "Keystone Storage Manager 8.4",
  legacyHost: "brennan.keystonesm.net",
  gate: "PDK",
  dealer: "Sierra Access & Security",
  bank: "Sierra Pacific Credit Union",
  plan: "Professional",
  price: 999, // per month, up to 5 facilities (Storify's Professional tier)
  trialDays: 60,
  termMonths: 12,
  lockMonths: 24,
  trialEnds: "Nov 30, 2026",
  firstInvoice: "Dec 1, 2026",
  startedAt: "Wed Sep 30 · 6:12 pm",
  cutoverAt: "Fri Oct 2 · 5:45 am",
};

export const PEOPLE: Record<string, Person> = {
  jordan: { id: "jordan", name: "Jordan Lee", role: "Growth", org: "Zonera", email: "jordan@zonera.com" },
  gail: { id: "gail", name: "Gail Brennan", role: "Owner", org: "Brennan Storage Co.", email: "gail@brennanstorage.com", phone: "(530) 555-0110" },
  priya: { id: "priya", name: "Priya Raman", role: "Facility manager, Alder Lake", org: "Brennan Storage Co.", email: "priya@brennanstorage.com", phone: "(530) 555-0142" },
  marcus: { id: "marcus", name: "Marcus Webb", role: "Account manager", org: "Sierra Access & Security", email: "marcus@sierraaccess.com" },
  fde: { id: "fde", name: "Zonera onboarding", role: "Automated FDE", org: "Zonera", email: "onboarding@zonera.com" },
};

const L = (src: string, t: string, who: string, text: string) => ({ id: `${src}-${t.replace(":", "")}`, t, who, text });

export const SOURCES: Source[] = [
  {
    id: "c1",
    kind: "call",
    title: "Discovery call",
    when: "Thu Sep 24 · 11:02 am",
    duration: "27 min",
    people: ["jordan", "gail"],
    summary: "Three sites on Keystone since 2012. Double entry for gate codes, 11% monthly delinquency, no online rentals, voicemail after 6 pm. Hard no on another long implementation.",
    lines: [
      L("c1", "00:12", "jordan", "Thanks for making time, Gail. Tell me about the three sites."),
      L("c1", "00:31", "gail", "Alder Lake is the big one, 181 units up by the lake. Then two in the city: Dolores in the Mission, and the little one on the Embarcadero, Pier 7."),
      L("c1", "01:05", "jordan", "What are you running them on today?"),
      L("c1", "01:09", "gail", "Keystone. Keystone Storage Manager, version eight-something. We've been on it since 2012. It works, but getting anything out of it is a nightmare."),
      L("c1", "02:40", "jordan", "What does a move-in look like for your manager?"),
      L("c1", "02:48", "gail", "Priya types everything twice. Once in Keystone, then the gate code again in the PDK app. If she forgets, the tenant is standing at the gate calling us."),
      L("c1", "04:15", "jordan", "How are collections?"),
      L("c1", "04:21", "gail", "Honestly, that's the bleeding. We lose like eleven percent a month to late payers, and Priya spends Mondays on the phone chasing them."),
      L("c1", "06:02", "jordan", "And after hours?"),
      L("c1", "06:06", "gail", "After six it goes to voicemail. Half those people rent from the place down the road the next morning."),
      L("c1", "08:30", "gail", "Our website is basically a phone number. You can't reserve anything online."),
      L("c1", "11:12", "jordan", "What would make switching a no-go?"),
      L("c1", "11:18", "gail", "Over a hundred people are on autopay at Alder Lake. If those break on the fifth of the month, I'm dead."),
      L("c1", "11:41", "gail", "And I'm not doing another six-week implementation. Last time we switched gate vendors it took the whole summer."),
      L("c1", "12:05", "jordan", "Fair. What if you didn't export anything or fill out a form? You share a login and we take it from there."),
      L("c1", "12:14", "gail", "Then I'd say you're lying. But I'd love to see it."),
      L("c1", "14:22", "gail", "Oh, and the lease. My attorney redid it in March. The lien language has to stay exactly as written. California is strict about that."),
      L("c1", "15:03", "jordan", "We'll use it word for word. Can I bring Priya into the next call?"),
      L("c1", "15:09", "gail", "Please. She's the one who'll live in it."),
    ],
  },
  {
    id: "c2",
    kind: "call",
    title: "Walkthrough and terms",
    when: "Wed Sep 30 · 5:30 pm",
    duration: "41 min",
    people: ["jordan", "gail", "priya"],
    summary: "Priya confirms the PDK dealer and the late-fee timeline. Gail wants existing rates held for six months and payouts to stay at Sierra Pacific. Professional plan, 60 days free, 12-month term, price locked 24 months. Live before the Oct 5 autopay run.",
    lines: [
      L("c2", "00:20", "jordan", "Priya, great to meet you. Gail says you type every gate code twice."),
      L("c2", "00:27", "priya", "Every single one. And when someone moves out I have to remember to kill the code in PDK too. I don't always."),
      L("c2", "03:10", "priya", "Our gate was installed by Sierra Access. Marcus Webb. He has the PDK account; we just have the app on the office iPad."),
      L("c2", "05:44", "gail", "If we switch, I don't want anyone's rent changing the day we switch. Leave existing tenants alone for six months, at least."),
      L("c2", "09:31", "priya", "Late fees: we text on day one, twenty-five dollar fee on day six, overlock on day ten, and the preliminary lien notice goes out on day fourteen."),
      L("c2", "13:05", "gail", "Rent has to keep landing at Sierra Pacific Credit Union. Same account Keystone deposits to now."),
      L("c2", "16:40", "priya", "Can I get my own login without seeing Gail's banking stuff?"),
      L("c2", "16:46", "jordan", "Yes. Manager role, no payouts, no owner reports."),
      L("c2", "21:18", "gail", "On the storefront: honestly, I'd love to be on your network brand if it gets us found."),
      L("c2", "27:02", "jordan", "On pricing: Professional covers all three sites at nine ninety-nine a month, and we waive the first sixty days while you switch."),
      L("c2", "27:20", "gail", "Twelve-month term, and the price holds for two years."),
      L("c2", "27:26", "jordan", "Done. Twelve months, price locked for twenty-four."),
      L("c2", "33:47", "gail", "So when can we be live?"),
      L("c2", "33:50", "jordan", "Before the weekend. You'll get one link tonight. Everything else is on us."),
      L("c2", "34:02", "gail", "Before the fifth. That's when autopay runs. That's my only deadline."),
    ],
  },
  {
    id: "e1",
    kind: "email",
    title: "Re: your Zonera setup",
    when: "Thu Oct 1 · 7:52 am",
    people: ["gail"],
    summary: "Brennan is a U-Haul neighborhood dealer at Alder Lake. Truck questions come in constantly.",
    late: true,
    lines: [
      L("e1", "07:52", "gail", "Jordan, forgot to mention on the call: we're a U-Haul dealer at the Alder Lake front desk. People ask about trucks constantly. Can your agent handle that too? Gail"),
    ],
  },
];

export const SOURCE_BY_ID = new Map(SOURCES.map(s => [s.id, s]));
export const LINE_BY_ID = new Map(SOURCES.flatMap(s => s.lines.map(l => [l.id, l] as const)));

const C = (line: string, quote: string) => ({ source: line.split("-")[0], line, quote });

export const REQUIREMENTS: Requirement[] = [
  { id: "R1", category: "migration", title: "Move everything out of Keystone 8.4", detail: "Tenants, units, ledgers, notes and documents for all three sites. No exports from the owner.", capability: "Browser migration", cites: [C("c1-0109", "getting anything out of it is a nightmare"), C("c1-1205", "You share a login and we take it from there")] },
  { id: "R2", category: "gate", title: "One gate code system", detail: "Zonera writes codes to PDK on move-in and revokes them on move-out. No double entry.", capability: "PDK cloud sync", cites: [C("c1-0248", "types everything twice… the gate code again in the PDK app"), C("c2-0027", "I have to remember to kill the code in PDK too")] },
  { id: "R3", category: "collections", title: "Automate the late-payment playbook", detail: "Text day 1, $25 fee day 6, overlock day 10.", capability: "Collections agent", cites: [C("c1-0421", "We lose like eleven percent a month to late payers"), C("c2-0931", "text on day one, twenty-five dollar fee on day six, overlock on day ten")] },
  { id: "R4", category: "legal", title: "Attorney's lease, word for word", detail: "Use the March revision verbatim. California lien timeline: preliminary notice day 14.", capability: "Lease + lien workflow (CA §21700)", cites: [C("c1-1422", "The lien language has to stay exactly as written"), C("c2-0931", "preliminary lien notice goes out on day fourteen")] },
  { id: "R5", category: "rates", title: "Hold existing rates for 6 months", detail: "No rent changes at cutover. Rate reviews paused until April 2027.", capability: "Rate guardrail", cites: [C("c2-0544", "Leave existing tenants alone for six months, at least")] },
  { id: "R6", category: "storefront", title: "Rent online", detail: "Live inventory, sizes and checkout on the website.", capability: "Storefront", cites: [C("c1-0830", "You can't reserve anything online")] },
  { id: "R7", category: "phones", title: "Answer calls after 6 pm", detail: "Zonera Voice takes the line after hours, rents and reserves.", capability: "Zonera Voice", cites: [C("c1-0606", "After six it goes to voicemail")] },
  { id: "R8", category: "payments", title: "106 autopays keep working", detail: "Card-on-file moves processor to processor as network tokens. No tenant re-enters a card.", capability: "Token migration", cites: [C("c1-1118", "If those break on the fifth of the month, I'm dead")] },
  { id: "R9", category: "timeline", title: "Live before the Oct 5 autopay run", detail: "Cutover before the weekend; autopay dry run before the 5th.", capability: "Cutover scheduler", cites: [C("c2-3402", "Before the fifth. That's when autopay runs.")] },
  { id: "R10", category: "payments", title: "Payouts to Sierra Pacific", detail: "Same deposit account Keystone uses today.", capability: "Stripe payouts", cites: [C("c2-1305", "Rent has to keep landing at Sierra Pacific Credit Union")] },
  { id: "R11", category: "team", title: "Manager login without financials", detail: "Priya: manager role, no payouts, no owner reports.", capability: "Roles", cites: [C("c2-1640", "my own login without seeing Gail's banking stuff")] },
  { id: "R12", category: "brand", title: "Join the Zonera network brand", detail: "Storefront as Zonera Alder Lake, listed in the network.", capability: "Network listing", cites: [C("c2-2118", "I'd love to be on your network brand")] },
  { id: "R13", category: "commercial", title: "Professional · 60 days free · 12 mo · locked 24 mo", detail: "$999/mo for up to 5 facilities. First invoice Dec 1, 2026.", capability: "MSA + subscription", cites: [C("c2-2702", "nine ninety-nine a month… waive the first sixty days"), C("c2-2726", "Twelve months, price locked for twenty-four")] },
  { id: "R14", category: "storefront", title: "Truck rentals at the front desk", detail: "U-Haul neighborhood dealer: show trucks on the storefront, agent answers truck questions.", capability: "Partner desk", late: true, cites: [C("e1-0752", "we're a U-Haul dealer at the Alder Lake front desk")] },
];

export const REQ_BY_ID = new Map(REQUIREMENTS.map(r => [r.id, r]));

// The owner's checklist. Nothing here is a template: every item exists because of
// something in the context, and each says why.
export const OWNER_ITEMS: OwnerItem[] = [
  {
    id: "O1", kind: "credential", group: "needs", minutes: 2, reqs: ["R1", "R8"],
    title: "Share your Keystone login",
    why: "We'll move tenants, ledgers and documents ourselves. You don't export anything.",
    cite: C("c1-1205", "You share a login and we take it from there"),
    prefill: { host: "brennan.keystonesm.net", user: "gail.brennan" },
    alt: "Prefer not to? Upload a rent roll and ledger export instead.",
  },
  {
    id: "O2", kind: "delegate", group: "needs", minutes: 1, reqs: ["R2"],
    title: "Let us ask Marcus for PDK access",
    why: "Sierra Access holds your PDK account. We'll email Marcus, copy you, and chase it.",
    cite: C("c2-0310", "Marcus Webb. He has the PDK account"),
    prefill: { dealer: "Sierra Access & Security", contact: "Marcus Webb", email: "marcus@sierraaccess.com" },
    alt: "Have the API key already? Paste it instead.",
  },
  {
    id: "O3", kind: "upload", group: "needs", minutes: 1, reqs: ["R4"],
    title: "Upload your lease (March revision)",
    why: "We'll use it word for word and keep the California lien language exactly as written.",
    cite: C("c1-1422", "My attorney redid it in March"),
    prefill: { file: "Brennan_Rental_Agreement_2026-03.pdf" },
  },
  {
    id: "O4", kind: "confirm", group: "confirm", minutes: 0.5, reqs: ["R3", "R4"],
    title: "Your late-payment playbook",
    why: "Exactly what Priya described. Confirm and the collections agent runs it.",
    cite: C("c2-0931", "text on day one, twenty-five dollar fee on day six, overlock on day ten"),
    prefill: { d1: "Text reminder", d6: "$25 late fee", d10: "Overlock", d14: "Preliminary lien notice" },
  },
  {
    id: "O5", kind: "choice", group: "confirm", minutes: 0.5, reqs: ["R5"],
    title: "Existing tenants' rent",
    why: "You asked us not to change anyone's rent at the switch.",
    cite: C("c2-0544", "Leave existing tenants alone for six months"),
    options: [
      { value: "6", label: "Hold for 6 months", sub: "Rate reviews resume April 2027" },
      { value: "12", label: "Hold for 12 months", sub: "Resume October 2027" },
      { value: "agent", label: "Let the agent propose", sub: "You approve every notice" },
    ],
    prefill: { value: "6" },
  },
  {
    id: "O6", kind: "choice", group: "confirm", minutes: 0.5, reqs: ["R12"],
    title: "Your storefront name",
    why: "You mentioned the network brand. Either way, it's your facility.",
    cite: C("c2-2118", "I'd love to be on your network brand"),
    options: [
      { value: "network", label: "Zonera Alder Lake", sub: "Listed in the Zonera network" },
      { value: "own", label: "Alder Lake Self Storage", sub: "Your name, powered by Zonera" },
    ],
    prefill: { value: "network" },
  },
  {
    id: "O7", kind: "form", group: "confirm", minutes: 0.5, reqs: ["R10"],
    title: "Confirm your payout account",
    why: "We found the account Keystone deposits to. Confirm it and rent keeps landing there.",
    cite: C("c2-1305", "Same account Keystone deposits to now"),
    prefill: { bank: "Sierra Pacific Credit Union", routing: "•••• 4108", account: "•••• 0918" },
    waitsOn: ["T6"],
  },
  {
    id: "O8", kind: "form", group: "confirm", minutes: 0.5, reqs: ["R11"],
    title: "Invite Priya",
    why: "Manager role: tenants, gate, units. No payouts, no owner reports.",
    cite: C("c2-1640", "my own login without seeing Gail's banking stuff"),
    prefill: { name: "Priya Raman", email: "priya@brennanstorage.com", role: "Manager · no financials" },
  },
  {
    id: "O9", kind: "confirm", group: "confirm", minutes: 0.5, reqs: ["R7"],
    title: "After-hours calls",
    why: "From 6 pm to 9 am your line forwards to Zonera Voice. It rents, reserves and takes messages.",
    cite: C("c1-0606", "After six it goes to voicemail"),
    prefill: { number: "(530) 555-0142", hours: "6:00 pm – 9:00 am" },
  },
  {
    id: "O10", kind: "sign", group: "needs", minutes: 2, reqs: ["R13", "R4"],
    title: "Sign the agreement",
    why: "Generated from what you and Jordan agreed on the call. Terms highlighted.",
    cite: C("c2-2726", "Twelve months, price locked for twenty-four"),
  },
  {
    id: "O11", kind: "pay", group: "needs", minutes: 1, reqs: ["R13"],
    title: "Start your subscription",
    why: "Nothing is charged until Dec 1. Card on file for after the 60 free days.",
    cite: C("c2-2702", "we waive the first sixty days"),
  },
  {
    id: "O12", kind: "confirm", group: "confirm", minutes: 0.5, reqs: ["R14"], late: true,
    title: "Truck rentals at the front desk",
    why: "From your email this morning. Show U-Haul trucks on your storefront and let the agent answer truck questions?",
    cite: C("e1-0752", "Can your agent handle that too?"),
  },
];

export const ITEM_BY_ID = new Map(OWNER_ITEMS.map(i => [i.id, i]));

// The internal plan. Every task cites requirements; the VM column says where it runs.
export const TASKS: Task[] = [
  { id: "T1", title: "Read 2 calls + email thread → requirement graph", role: "analyst", vm: "vm-0a1c", who: "agent", reqs: [], needs: [] },
  { id: "T2", title: "Compile plan and the owner's checklist", role: "architect", vm: "vm-2b7e", who: "agent", reqs: [], needs: ["T1"] },
  { id: "T3", title: "Public data: parcel, permits, Google profile, photos", role: "builder", vm: "vm-3c4d", who: "agent", reqs: ["R6"], needs: ["T2"] },
  { id: "T4", title: "Draft the 3D twin from permits + satellite", role: "builder", vm: "vm-3c4d", who: "agent", reqs: ["R6"], needs: ["T3"] },
  { id: "T5", title: "Storefront: Zonera Alder Lake, live inventory", role: "builder", vm: "vm-3c4d", who: "agent", reqs: ["R6", "R12"], needs: ["T4", "O6"] },
  { id: "T6", title: "Keystone: rent roll, units, rates, deposit settings", role: "migrator", vm: "vm-4d90", who: "agent", reqs: ["R1"], needs: ["O1"] },
  { id: "T7", title: "Keystone: ledgers and payment history", role: "migrator", vm: "vm-4e12", who: "agent", reqs: ["R1"], needs: ["O1"] },
  { id: "T8", title: "Keystone: tenant documents and notes", role: "migrator", vm: "vm-4f55", who: "agent", reqs: ["R1"], needs: ["O1"] },
  { id: "T9", title: "Autopay: processor-to-processor token transfer", role: "integrator", vm: "vm-5a08", who: "agent", reqs: ["R8"], needs: ["T6"] },
  { id: "T10", title: "Email Sierra Access for PDK API access", role: "integrator", vm: "vm-5a08", who: "vendor", reqs: ["R2"], needs: ["O2"] },
  { id: "T11", title: "PDK: map zones, sync codes, revoke on move-out", role: "integrator", vm: "vm-5a08", who: "agent", reqs: ["R2"], needs: ["T10", "T6"] },
  { id: "T12", title: "Phones: after-hours forwarding to Zonera Voice", role: "integrator", vm: "vm-5a08", who: "agent", reqs: ["R7"], needs: ["O9"] },
  { id: "T13", title: "Stripe: subscription + payouts account", role: "integrator", vm: "vm-5a08", who: "agent", reqs: ["R10", "R13"], needs: ["O7", "O11"] },
  { id: "T14", title: "Lease template + CA lien workflow", role: "architect", vm: "vm-2b7e", who: "agent", reqs: ["R4"], needs: ["O3"] },
  { id: "T15", title: "Collections playbook", role: "architect", vm: "vm-2b7e", who: "agent", reqs: ["R3"], needs: ["O4"] },
  { id: "T16", title: "Rate hold for existing tenants", role: "architect", vm: "vm-2b7e", who: "agent", reqs: ["R5"], needs: ["O5", "T6"] },
  { id: "T17", title: "Team and roles", role: "architect", vm: "vm-2b7e", who: "agent", reqs: ["R11"], needs: ["O8"] },
  { id: "T18", title: "Reconcile tenants, units, ledgers to the cent", role: "validator", vm: "vm-6c3b", who: "agent", reqs: ["R1"], needs: ["T6", "T7", "T8"] },
  { id: "T19", title: "Read back every gate code from PDK", role: "validator", vm: "vm-6c3b", who: "agent", reqs: ["R2"], needs: ["T11"] },
  { id: "T20", title: "Autopay dry run ($0 auth)", role: "validator", vm: "vm-6c3b", who: "agent", reqs: ["R8", "R9"], needs: ["T9"] },
  { id: "T21", title: "Cut over at 5:45 am, before the gate opens", role: "architect", vm: "vm-2b7e", who: "agent", reqs: ["R9"], needs: ["T5", "T12", "T13", "T14", "T15", "T16", "T17", "T18", "T19", "T20", "O10", "O11"] },
  { id: "T23", title: "Re-read context: Gail's 7:52 am email", role: "analyst", vm: "vm-0a1c", who: "agent", reqs: ["R14"], needs: [], late: true },
  { id: "T22", title: "Truck rental desk on storefront + agent skill", role: "builder", vm: "vm-3c4d", who: "agent", reqs: ["R14"], needs: ["O12"], late: true },
];

export const TASK_BY_ID = new Map(TASKS.map(t => [t.id, t]));

export const MAILS: Record<string, Mail> = {
  portal: {
    id: "portal", dir: "out", from: "Jordan Lee <jordan@zonera.com>", to: "Gail Brennan <gail@brennanstorage.com>", when: "Wed Sep 30 · 6:19 pm",
    subject: "Your Zonera setup: 5 things, about 9 minutes",
    body: "Gail, thanks for the time today. Here's everything we need from you, nothing else: your Keystone login, a yes for us to ask Marcus about PDK, your March lease, a signature and a card. We'll do the rest and you can watch it happen. Live before the 5th. Jordan",
  },
  dealer: {
    id: "dealer", dir: "out", from: "Zonera onboarding <onboarding@zonera.com>", to: "Marcus Webb <marcus@sierraaccess.com>", when: "Wed Sep 30 · 6:31 pm",
    subject: "PDK API access for Alder Lake Self Storage (cc Gail Brennan)",
    body: "Hi Marcus, Gail Brennan is moving Alder Lake Self Storage to Zonera and has asked us to connect to their PDK cloud controller. Could you issue an API key scoped to the Alder Lake site (read/write credentials, read events)? Gail is copied and has approved. Thank you.",
  },
  dealerNudge: {
    id: "dealerNudge", dir: "out", from: "Zonera onboarding <onboarding@zonera.com>", to: "Marcus Webb <marcus@sierraaccess.com>", when: "Thu Oct 1 · 10:00 am",
    subject: "Re: PDK API access for Alder Lake Self Storage",
    body: "Morning Marcus, a gentle nudge on the API key for Alder Lake. Happy to hop on a 5-minute call if easier: (415) 555-0199.",
  },
  dealerReply: {
    id: "dealerReply", dir: "in", from: "Marcus Webb <marcus@sierraaccess.com>", to: "Zonera onboarding <onboarding@zonera.com>", when: "Thu Oct 1 · 11:18 am",
    subject: "Re: PDK API access for Alder Lake Self Storage",
    body: "Done. API key and site ID for Alder Lake attached, scoped to credentials + events. Let me know if the sync gives you trouble. Marcus",
  },
  followup: {
    id: "followup", dir: "in", from: "Gail Brennan <gail@brennanstorage.com>", to: "Jordan Lee <jordan@zonera.com>", when: "Thu Oct 1 · 7:52 am",
    subject: "Re: your Zonera setup",
    body: "Jordan, forgot to mention on the call: we're a U-Haul dealer at the Alder Lake front desk. People ask about trucks constantly. Can your agent handle that too? Gail",
  },
  priyaSms: {
    id: "priyaSms", dir: "out", from: "Zonera onboarding · SMS", to: "Priya Raman (530) 555-0142", when: "Thu Oct 1 · 2:41 pm",
    subject: "Quick one about D-209",
    body: "Hi Priya, it's Zonera setting up Alder Lake. Keystone has D-209 as 10×15 but the 2014 site plan says 10×10. Which is right?",
  },
  priyaReply: {
    id: "priyaReply", dir: "in", from: "Priya Raman · SMS", to: "Zonera onboarding", when: "Thu Oct 1 · 2:47 pm",
    subject: "Re: D-209",
    body: "It's a 10×10. Keystone's been wrong since we re-priced in 2019, never fixed it.",
  },
  live: {
    id: "live", dir: "out", from: "Zonera <hello@zonera.com>", to: "Gail Brennan, Priya Raman", when: "Fri Oct 2 · 5:47 am",
    subject: "Alder Lake is live on Zonera",
    body: "Good morning. Alder Lake moved to Zonera at 5:45 am, before the gate opened. Every tenant, balance and gate code is verified. Your first morning briefing is ready in the console. Just ask.",
  },
};

export const EXCEPTIONS: Record<string, Exception> = {
  dup: {
    id: "dup", route: "human",
    title: "Two Keystone records look like the same person",
    detail: "“Matt Okafor” (C-114, closed 2023) and “Matthew Okafor” (A-122, active) share a phone number and driver's license. The closed record carries a $0 balance and a 2023 lien note.",
    evidence: ["Phone (530) 555-0187 on both", "Same DL ending 4471 on file", "C-114 closed Feb 2023, balance $0.00", "Lien note on C-114: “released, paid in full”"],
    recommendation: "Merge into one tenant. Keep the 2023 history as a past rental so the lien note isn't lost.",
    options: [
      { id: "merge", label: "Merge, keep history", primary: true },
      { id: "separate", label: "Keep separate" },
    ],
  },
  size: {
    id: "size", route: "owner",
    title: "D-209 size disagrees with the site plan",
    detail: "Keystone says 10×15; the 2014 permit site plan says 10×10. The storefront would price it wrong either way.",
    evidence: ["Keystone unit list: D-209 · 10×15 · $189", "2014 site plan sheet A2: D-209 · 10×10"],
    recommendation: "Ask Priya by text. She's on site.",
    options: [{ id: "ask", label: "Text Priya", primary: true }],
  },
};
