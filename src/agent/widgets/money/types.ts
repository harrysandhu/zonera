// Props and answer types for the money widgets (src/agent/widgets/money).
// Registered in widgets/ext/money.ts. Front desk reuses `stripePay` for
// move-in payments, so its contract is documented in detail.

export type Brand = "Visa" | "Mastercard" | "Amex" | "Discover";

/** "cash" · "card" (card on file) · "new-card" (Stripe Elements) · "reader" (Tap to Pay) · "check" · "ach" */
export type StripeMethod = "card" | "new-card" | "reader" | "cash" | "check" | "ach";

export interface SavedCard {
  id: string; // pm_…
  brand: Brand;
  last4: string;
  exp: string; // "09/26"
  status: "ok" | "expired" | "declined";
  note?: string; // "Declined Sep 23 · insufficient funds"
  autopay?: boolean; // this card runs autopay
}

export interface PayCharge {
  id: string;
  label: string; // "Rent · Sep 14 – Oct 13"
  amount: number;
  date?: string; // ISO
  hint?: string; // "incl. $12 protection"
  kind?: "rent" | "fee" | "other" | "future" | "movein";
  unit?: string;
}

// ---- W14 StripePay
export interface StripePayProps {
  payer: string; // "Matthew Okafor"
  unit?: string; // "A-122" (several: "A-122, A-124")
  title?: string; // default "Take payment"
  method: StripeMethod;
  /** Tabs to offer, in order. Default: all six. */
  methods?: StripeMethod[];
  /** Open charges, oldest first. A payment fills them in order; the rest is credit. */
  charges: PayCharge[];
  /** Upcoming charges a larger payment can prepay (next month's rent). */
  future?: PayCharge[];
  /** Prefilled amount. Default: sum of charges. */
  amount?: number;
  /** Lock the amount (move-in totals). */
  fixedAmount?: boolean;
  /** Saved cards (card on file tab). The first usable card is preselected. */
  cards?: SavedCard[];
  /** Customer id shown on Stripe surfaces. */
  customer?: string;
  phone?: string;
  email?: string;
  receipt?: "sms" | "email" | "both" | "none";
  /** Offer "Use this card for autopay" on new card / Tap to Pay / card on file. */
  offerAutopay?: boolean;
  /** Preset for the new-card form (prefilled when the card was read from a wallet). */
  cardholder?: string;
  zip?: string;
  /** What the Tap to Pay reader will read (the demo's "physical" card). */
  tap?: { brand: Brand; last4: string; wallet?: "Apple Pay" | "Google Pay" };
  /** Check details (prefilled when the agent already knows them). */
  check?: { number?: string; bank?: string; date?: string };
  ach?: { bank: string; last4: string; type?: "Checking" | "Savings" };
  /** Cash drawer the payment lands in, and what it holds now. */
  drawer?: { name: string; expected: number };
  /** Recording a payment that already happened ("paid earlier"). */
  received?: { date: string; time: string };
  /** Inline warning shown above the form. */
  note?: string;
  /** What the payment does once the balance clears ("Removes the overlock on A-122"). */
  unlocks?: string;
  cta?: string;
}

export interface StripePayAnswer {
  method: StripeMethod;
  amount: number;
  allocation: { id: string; label: string; amount: number }[];
  /** Overpayment left on account. */
  credit: number;
  receipt: "sms" | "email" | "both" | "none";
  /** Ledger method text: "Cash at the office", "Card · Visa •• 4242", "Tap to Pay · Visa •• 0419" … */
  methodText: string;
  card?: { brand: Brand; last4: string; exp?: string; wallet?: string; id?: string };
  /** Stripe ids for card / Tap to Pay / ACH. */
  pi?: string;
  charge?: string;
  tendered?: number;
  change?: number;
  check?: { number: string; bank: string; photo: boolean; date: string };
  ach?: { bank: string; last4: string };
  autopay?: boolean; // make this card the autopay card
  received?: { date: string; time: string };
  // Compatibility with the core PaymentForm answer.
  sms: boolean;
}

// ---- Tap to Pay (standalone)
export interface TapToPayProps {
  payer: string;
  amount: number;
  tap?: { brand: Brand; last4: string; wallet?: "Apple Pay" | "Google Pay" };
  title?: string;
}
export interface TapToPayAnswer {
  card: { brand: Brand; last4: string; wallet?: string };
  pi: string;
  amount: number;
}

// ---- CheckCapture (standalone)
export interface CheckCaptureProps {
  payer: string;
  amount: number;
  number?: string;
  bank?: string;
  memo?: string;
}
export interface CheckCaptureAnswer {
  number: string;
  bank: string;
  amountRead: number;
  photo: boolean;
}

// ---- W16 RefundForm
export interface RefundTxn {
  id: string;
  date: string; // ISO
  time?: string; // "9:17 am"
  label: string; // "Autopay retry"
  amount: number; // original amount
  refundable: number;
  method: string; // "Visa •• 4242"
  ref?: string; // ch_… or RCPT-…
  flag?: "dup" | "prepaid";
  note?: string;
}
export interface RefundProps {
  payer: string;
  unit?: string;
  txns: RefundTxn[];
  selected?: string[];
  /** Prefill a partial amount (e.g. half). */
  amount?: number;
  reason?: string;
  reasons: string[];
  destinations: { id: "card" | "credit" | "check"; label: string; sub?: string }[];
  destination?: "card" | "credit" | "check";
  /** Balance before, and whether the refund leaves it unchanged (duplicate / unused prepaid). */
  balance: number;
  netZero?: boolean;
  note?: string;
}
export interface RefundAnswer {
  ids: string[];
  amount: number;
  partial: boolean;
  reason: string;
  destination: "card" | "credit" | "check";
  re?: string; // Stripe refund id
}

// ---- W17 CreditWaive
export interface WaiveLine {
  id: string;
  date: string;
  label: string;
  amount: number;
  on?: boolean;
  note?: string;
}
export interface CreditWaiveProps {
  payer: string;
  unit?: string;
  balance: number;
  lines: WaiveLine[];
  /** Offer a courtesy credit amount row (no fee to waive, or extra goodwill). */
  credit?: number;
  reasons: string[];
  reason?: string;
  /** Unit that unlocks if the balance reaches zero. */
  lockedUnit?: string;
  note?: string;
}
export interface CreditWaiveAnswer {
  ids: string[];
  amount: number;
  credit: number;
  reason: string;
}

// ---- W18 PaymentPlan
export interface PaymentPlanProps {
  payer: string;
  unit: string;
  balance: number;
  rent: number;
  /** Next rent due date (ISO); installments ride along with rent. */
  nextDue: string;
  installments: number;
  options: number[];
  /** Late fees that can be waived as a goodwill gesture on signing. */
  fees: { id: string; label: string; amount: number }[];
  waive?: boolean;
  down?: number;
  card?: string | null; // card to put on autopay, or null (collected at signing)
  lockedUnit?: string;
  lien?: boolean; // lien steps are in progress / due
}
export interface PaymentPlanAnswer {
  n: number;
  down: number;
  waived: number;
  financed: number;
  schedule: { date: string; plan: number; rent: number }[];
  autopay: boolean;
  unlock: "now" | "first" | "paid";
  pauseLien: boolean;
}

// ---- Agreement / e-sign status (show, update live)
export interface AgreementProps {
  title: string; // "Payment plan agreement"
  doc: string; // "payment-plan-A131.pdf"
  envelope: string; // "env_…"
  signer: string;
  to: string; // "SMS (530) 555-0166 · dana.whitfield@…"
  terms: string[];
  status: "draft" | "sent" | "delivered" | "opened" | "signed";
  events: { label: string; at: string }[];
}

// ---- CashDrawer
export interface CashDrawerProps {
  drawer: string; // "Drawer 1 · Front desk"
  opening: number;
  /** Cash taken today. */
  cash: { label: string; amount: number; at?: string; ref?: string }[];
  /** Checks to deposit with the cash. */
  checks: { label: string; amount: number; ref?: string }[];
  expected: number;
  keep: number; // float left in the drawer
  tolerance: number;
}
export interface CashDrawerAnswer {
  counts: Record<string, number>;
  counted: number;
  variance: number;
  deposit: number;
  checks: number;
  note?: string;
}

// ---- PrepayQuote
export interface PrepayQuoteProps {
  who: string;
  unit: string;
  size: string; // "5×10"
  rent: number; // monthly rent (base, before protection)
  protection: number; // monthly protection premium
  protectionLabel?: string;
  months: number;
  options: number[];
  /** Discount on rent by months prepaid, e.g. { 6: 0.05, 12: 0.1 }. */
  discounts: Record<number, number>;
  admin?: number; // one-time admin fee (new rentals)
  start: string; // ISO, first day covered
  /** Primary action label, e.g. "Text Hana the quote". */
  primary: string;
  secondary?: string; // "Take payment now"
}
export interface PrepayQuoteAnswer {
  months: number;
  total: number;
  savings: number;
  through: string; // ISO last day covered
  action: "primary" | "secondary";
}
