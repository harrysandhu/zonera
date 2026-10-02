// Props and answer types for the comms widgets (src/agent/widgets/comms).
// Widget numbers are from docs/agent-catalog.md.

// ---- W6 EmailDraft: one email (or one letter): to, subject, body, attachments
export interface DraftParty {
  id: string;
  name: string;
  /** Email address, or a postal address in letter mode. */
  address: string;
  note?: string; // "Returned Sep 14 · not at this address"
  tone?: "warn" | "ok";
  /** Optional recipients (cc, alternate contact) start toggled on or off. */
  on?: boolean;
}
export interface DraftAttachment {
  name: string; // "notice-to-vacate-A-131.pdf"
  meta?: string; // "PDF · 2 pages"
  on?: boolean;
}
export interface EmailDraftProps {
  mode?: "email" | "letter";
  title?: string;
  from?: string;
  to: DraftParty[];
  cc?: DraftParty[];
  ccLabel?: string; // "Copy to"
  subject: string;
  body: string;
  attachments?: DraftAttachment[];
  /** Letter delivery options (first-class, certified …). */
  delivery?: { value: string; label: string; hint?: string }[];
  deliveryValue?: string;
  /** Inline warning above the body. */
  warn?: string;
  tier?: string;
  cta?: string;
  secondary?: string;
}
export interface EmailDraftAnswer {
  action: "send" | "cancel";
  subject: string;
  body: string;
  cc: string[]; // ids of optional recipients left on
  attachments: string[];
  delivery?: string;
}

// ---- W7 ThreadPreview: threads with a drafted reply appended
export interface ThreadMsg {
  dir: "in" | "out";
  text: string;
  at: string; // "8:51 am" or "Sep 20"
  who?: string;
}
export interface ThreadItem {
  id: string;
  name: string;
  sub?: string; // "A-122 · 10×10"
  channel: "sms" | "email";
  to: string;
  intent?: string; // "Hours"
  subject?: string;
  messages: ThreadMsg[];
  draft: string;
  on?: boolean; // default true
  /** Why the draft says what it says ("Checked the ledger: paid Oct 1"). */
  basis?: string;
}
export interface ThreadPreviewProps {
  title: string;
  meta?: string;
  threads: ThreadItem[];
  /** "{n}" is replaced with the count of replies left on. Default "Send {n} replies". */
  cta?: string;
}
export interface ThreadPreviewAnswer {
  replies: { id: string; text: string }[];
}
