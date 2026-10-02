// What the agent may do on its own (auto), must ask first (ask), or may never do.
// Edited on Settings → Agent permissions; read by agent mode.

export type Tier = "auto" | "ask" | "never";

export interface Perm {
  id: string;
  group: string;
  name: string;
  desc: string;
  tier: Tier;
  notes: Record<Tier, string>;
  locked?: Tier[];
}

export const PERMS: Perm[] = [
  { id: "msg", group: "Customers", name: "Reminders, receipts and replies", desc: "SMS and email to tenants and leads", tier: "auto", notes: { auto: "Sends on its own within quiet hours (8 am–8 pm). 412 messages last month.", ask: "Drafts each message and waits in your inbox. Replies slow to about 2 hours.", never: "Tenants hear from staff only. Payment reminders stop." } },
  { id: "calls", group: "Customers", name: "Outbound calls", desc: "Voice agent calls tenants and leads", tier: "auto", notes: { auto: "Calls during business hours, discloses it's an AI, hands off on request.", ask: "Queues each call for your approval in the call center.", never: "Voice agent answers inbound calls only." } },
  { id: "pay", group: "Money", name: "Take and record payments", desc: "Card, ACH, cash logged by staff", tier: "auto", notes: { auto: "Charges cards on file, records cash, emails receipts, lifts overlocks when paid.", ask: "Prepares the charge; you confirm each one.", never: "Payments are taken by staff in the ledger." } },
  { id: "refund", group: "Money", name: "Refunds and credits", desc: "Duplicate charges, prorations, goodwill", tier: "ask", notes: { auto: "Refunds up to $50 on its own; anything larger still asks.", ask: "Shows the refund with the ledger lines and waits for your approval.", never: "Tells the tenant a manager will follow up within one business day." } },
  { id: "fees", group: "Money", name: "Waive late fees", desc: "One-time courtesy waivers", tier: "ask", notes: { auto: "Waives one late fee per tenant per year when they pay in full.", ask: "Suggests a waiver with the tenant's history; you decide.", never: "Late fees always apply." } },
  { id: "rates", group: "Money", name: "Rate changes", desc: "Existing-customer increases and street rates", tier: "ask", notes: { auto: "Not recommended. Sends notices with the 30 days California requires.", ask: "Builds the impact preview and notices; nothing goes out until you approve.", never: "Rates change only when you edit them." } },
  { id: "gate", group: "Access", name: "Issue and revoke gate codes", desc: "Tenants, vendors, guests", tier: "auto", notes: { auto: "Issues codes limited to a zone and time window; vendor codes expire on their own.", ask: "Prepares the code and waits for you before it works.", never: "Codes are created by staff on the Gate access page." } },
  { id: "lock", group: "Access", name: "Overlock and remove overlocks", desc: "Lock-outs for past-due units", tier: "ask", notes: { auto: "Overlocks at 30 days past due after two notices; removes it the moment they pay.", ask: "Removes overlocks on payment by itself; asks before putting one on.", never: "Staff handle every overlock on site." }, locked: [] },
  { id: "movein", group: "Leases", name: "Move-ins and leases", desc: "ID check, e-sign, gate code", tier: "auto", notes: { auto: "Rents units at street or promo rate, verifies ID, sends the lease to sign.", ask: "Holds the unit and asks you to approve the lease before signing.", never: "Online rentals end at a reservation; staff finish move-in." } },
  { id: "moveout", group: "Leases", name: "Move-outs and final bills", desc: "Proration, inspection, re-listing", tier: "ask", notes: { auto: "Prorates, schedules the inspection, ends access and re-lists the unit.", ask: "Prepares the final bill and waits for the inspection sign-off.", never: "Staff process every move-out." } },
  { id: "vendors", group: "Facility", name: "Work orders and vendors", desc: "Book approved vendors up to $500", tier: "auto", notes: { auto: "Books approved vendors and issues their gate codes; asks above $500.", ask: "Drafts the work order and vendor message for you to send.", never: "The agent only logs issues; you assign them." } },
  { id: "promo", group: "Facility", name: "Promotions on the storefront", desc: "Publish, pause, end", tier: "ask", notes: { auto: "Publishes promos within the floor price you set.", ask: "Previews the storefront change and waits for you.", never: "Promotions are edited by staff only." } },
  { id: "lien", group: "Legal", name: "Lien notices and auctions", desc: "California Self-Service Storage Facility Act", tier: "never", notes: { auto: "Not available. Lien steps need a person.", ask: "Prepares notices on the statutory timeline; a manager signs and sends each one.", never: "Prepares the timeline and reminds you. It never sends a notice or schedules a sale." }, locked: ["auto"] },
];
