// Maintenance for Alder Lake: work orders, vendors, preventive schedule.
// Work orders are mutable; the Maintenance page, unit drawer and agent all write here
// and call commit() so every screen follows.

export type WOStatus = "new" | "scheduled" | "progress" | "done";
export type WOPriority = "urgent" | "high" | "normal" | "low";
export type WOCategory = "Doors" | "Gates & access" | "HVAC" | "Lighting" | "Pest" | "Cleaning" | "Safety" | "Other";
export type WOSource = "Sensor" | "Agent" | "Tenant" | "Walkthrough" | "Preventive" | "Manager";

export interface WorkOrder {
  id: string;
  title: string;
  location: string;
  unitId?: string;
  gateId?: string;
  status: WOStatus;
  priority: WOPriority;
  category: WOCategory;
  vendorId?: string;
  assignee?: string;
  opened: string;
  due: string;
  source: WOSource;
  notes: string;
  cost?: number;
  log: { at: string; text: string; agent?: boolean }[];
}

export interface Vendor {
  id: string;
  name: string;
  trade: string;
  contact: string;
  phone: string;
  rating: number;
  response: string;
  coi: string;
  coiWarn?: boolean;
  ytd: number;
}

export const VENDORS: Vendor[] = [
  { id: "basin-door", name: "Basin Door Co.", trade: "Roll-up doors", contact: "Luis Ortega", phone: "(530) 555-0181", rating: 4.8, response: "4 h", coi: "Mar 2027", ytd: 2140 },
  { id: "tahoe-gate", name: "Tahoe Gate & Access", trade: "Gates · PTI certified", contact: "Kim Tran", phone: "(530) 555-0193", rating: 4.9, response: "3 h", coi: "Jan 2027", ytd: 1880 },
  { id: "lakeside-mech", name: "Lakeside Mechanical", trade: "HVAC", contact: "Dev Patel", phone: "(530) 555-0144", rating: 4.7, response: "Next day", coi: "Jun 2027", ytd: 3260 },
  { id: "sierra-pest", name: "Sierra Pest Control", trade: "Pest control", contact: "Anna Kowalski", phone: "(530) 555-0110", rating: 4.6, response: "2 days", coi: "Feb 2027", ytd: 960 },
  { id: "alder-electric", name: "Alder Electric", trade: "Lighting · electrical", contact: "Sam Brooks", phone: "(530) 555-0127", rating: 4.5, response: "1 day", coi: "Oct 15, 2026", coiWarn: true, ytd: 1410 },
];
export const VENDOR_BY_ID = new Map(VENDORS.map(v => [v.id, v]));

export const STAFF = [
  { name: "Marco Ruiz", role: "Maintenance tech" },
  { name: "Jess Park", role: "Assistant manager" },
  { name: "Priya Raman", role: "Facility manager" },
];

export const WORK_ORDERS: WorkOrder[] = [
  {
    id: "WO-2051",
    title: "Roll-up door jammed",
    location: "C-112 · Building C",
    unitId: "C-112",
    status: "new",
    priority: "high",
    category: "Doors",
    vendorId: "basin-door",
    opened: "Today 7:58 am",
    due: "Today",
    source: "Walkthrough",
    notes: "Door stuck about 2 ft open, spring tension likely. Unit is held offline and can't be rented until it's fixed.",
    log: [
      { at: "7:58 am", text: "Marco flagged it on the morning walkthrough" },
      { at: "8:01 am", text: "Unit set to maintenance, removed from the storefront", agent: true },
      { at: "8:02 am", text: "Suggested Basin Door Co. (fixed 3 doors this year, 4 h response)", agent: true },
    ],
  },
  {
    id: "WO-2050",
    title: "Exit sensor offline",
    location: "Gate 2 · Exit lane",
    gateId: "G2",
    status: "scheduled",
    priority: "urgent",
    category: "Gates & access",
    vendorId: "tahoe-gate",
    opened: "Today 8:52 am",
    due: "Today 2:30 pm",
    source: "Sensor",
    notes: "Loop detector stopped reporting. Exits fall back to the keypad, so tenants enter their code to leave. Temporary code issued for Kim, 2–5 pm.",
    log: [
      { at: "8:52 am", text: "PTI controller reported a loop fault on Gate 2" },
      { at: "8:53 am", text: "Opened work order, switched Gate 2 to keypad exit", agent: true },
      { at: "8:55 am", text: "Texted Tahoe Gate & Access", agent: true },
      { at: "9:10 am", text: "Kim Tran confirmed a 2:30 pm visit" },
    ],
  },
  {
    id: "WO-2049",
    title: "HVAC filter replacement",
    location: "Building D · both air handlers",
    status: "scheduled",
    priority: "normal",
    category: "HVAC",
    vendorId: "lakeside-mech",
    opened: "Sep 18",
    due: "Today 1:00 pm",
    source: "Preventive",
    notes: "Quarterly filters for both air handlers. Temporary gate code issued for 1–5 pm, Building D only.",
    cost: 420,
    log: [
      { at: "Sep 18", text: "Created from the preventive schedule", agent: true },
      { at: "Sep 18", text: "Lakeside Mechanical booked Oct 2, 1:00 pm" },
      { at: "Today 8:15 am", text: "Issued gate code 418 206 for 1–5 pm, Building D", agent: true },
    ],
  },
  {
    id: "WO-2048",
    title: "Light out, lane B–C",
    location: "Lane B–C · pole 4",
    status: "progress",
    priority: "normal",
    category: "Lighting",
    assignee: "Marco Ruiz",
    opened: "Oct 1 8:40 pm",
    due: "Today",
    source: "Agent",
    notes: "Night camera check found pole 4 dark. Marco has a replacement LED head from stock.",
    log: [
      { at: "Oct 1 8:40 pm", text: "Camera check found pole 4 dark", agent: true },
      { at: "Today 7:30 am", text: "Assigned to Marco" },
      { at: "Today 9:20 am", text: "Marco started work" },
    ],
  },
  {
    id: "WO-2047",
    title: "Quarterly pest inspection",
    location: "All buildings",
    status: "scheduled",
    priority: "low",
    category: "Pest",
    vendorId: "sierra-pest",
    opened: "Sep 15",
    due: "Oct 6 8:00 am",
    source: "Preventive",
    notes: "Bait stations in A–D, RV lot perimeter. Code 305 118 active 8–11 am.",
    cost: 240,
    log: [{ at: "Sep 15", text: "Created from the preventive schedule", agent: true }],
  },
  {
    id: "WO-2046",
    title: "Clean-out after move-out",
    location: "D-105 · Building D",
    unitId: "D-105",
    status: "done",
    priority: "normal",
    category: "Cleaning",
    assignee: "Marco Ruiz",
    opened: "Sep 30",
    due: "Oct 1",
    source: "Agent",
    notes: "Swept, removed one shelf left behind, photos attached. Re-listed on the storefront.",
    log: [
      { at: "Sep 30", text: "Created after move-out inspection", agent: true },
      { at: "Oct 1 2:10 pm", text: "Marco marked it done, 6 photos" },
      { at: "Oct 1 2:11 pm", text: "D-105 re-listed at $79", agent: true },
    ],
  },
  {
    id: "WO-2045",
    title: "Keypad battery",
    location: "Gate 1 · Main entry",
    gateId: "G1",
    status: "done",
    priority: "normal",
    category: "Gates & access",
    assignee: "Marco Ruiz",
    opened: "Sep 29",
    due: "Sep 30",
    source: "Sensor",
    notes: "Battery at 12%. Replaced with a 12V lithium pack.",
    cost: 38,
    log: [{ at: "Sep 30 10:05 am", text: "Replaced, keypad back at 100%" }],
  },
  {
    id: "WO-2044",
    title: "Dented door panel",
    location: "B-118 · Building B",
    unitId: "B-118",
    status: "done",
    priority: "normal",
    category: "Doors",
    vendorId: "basin-door",
    opened: "Sep 24",
    due: "Sep 28",
    source: "Tenant",
    notes: "Tenant reported a dent from a trailer. Panel replaced, tenant not billed.",
    cost: 340,
    log: [{ at: "Sep 28 11:40 am", text: "Basin Door replaced the bottom panel" }],
  },
];

let woSeq = 2052;
export function nextWorkOrderId() {
  return "WO-" + woSeq++;
}

export interface Preventive {
  task: string;
  cadence: string;
  last: string;
  next: string;
  owner: string;
  state: "ok" | "due" | "overdue" | "today";
}

export const PREVENTIVE: Preventive[] = [
  { task: "Fire extinguisher check", cadence: "Monthly", last: "Sep 1", next: "Oct 1", owner: "Marco Ruiz", state: "overdue" },
  { task: "HVAC filters, Building D", cadence: "Quarterly", last: "Jul 2", next: "Oct 2", owner: "Lakeside Mechanical", state: "today" },
  { task: "Gate and keypad inspection", cadence: "Monthly", last: "Sep 4", next: "Oct 4", owner: "Tahoe Gate & Access", state: "due" },
  { task: "Camera and recorder health", cadence: "Weekly", last: "Sep 28", next: "Oct 5", owner: "Zonera agent", state: "due" },
  { task: "Pest inspection", cadence: "Quarterly", last: "Jul 6", next: "Oct 6", owner: "Sierra Pest Control", state: "due" },
  { task: "Lane sweeping", cadence: "Weekly", last: "Sep 30", next: "Oct 7", owner: "Marco Ruiz", state: "ok" },
  { task: "Roll-up door lubrication", cadence: "Twice a year", last: "Apr 14", next: "Oct 14", owner: "Basin Door Co.", state: "ok" },
  { task: "Roof and gutter inspection", cadence: "Yearly", last: "Nov 9, 2025", next: "Nov 9", owner: "Marco Ruiz", state: "ok" },
];
