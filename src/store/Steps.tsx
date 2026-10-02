import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, FileText, Lock, Upload, Wallet } from "lucide-react";
import { PROTECTION } from "../data/catalog";
import { UNIT_BY_ID } from "../data/facility";
import { clock, fmt } from "../state/store";
import { DEFAULTS, TODAY_ISO, setOrder, sizeLabel, type Order } from "./order";
import { PREPAY_MONTHS, money, quote, r2 } from "./pricing";
import { BRAND_LABEL, cardBrand, formatCard, formatExp, formatPhone, type Errors } from "./validate";
import { IdScan } from "./IdScan";

// One component per checkout question. Each reads the order and writes back with setOrder.

export interface StepProps {
  o: Order;
  errs: Errors;
  tap: string | null;
  next: () => void;
}

export const STEPS = [
  { id: "date", label: "Move-in date" },
  { id: "duration", label: "How long" },
  { id: "name", label: "Your name" },
  { id: "contact", label: "Contact" },
  { id: "protection", label: "Protection" },
  { id: "plan", label: "Billing" },
  { id: "id", label: "ID check" },
  { id: "payment", label: "Payment" },
  { id: "lease", label: "Lease" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];

const LETTERS = "ABCDEFG";

/** Lettered choices, typeform style: click, or press the letter. */
function Choices<T extends string | number>({ value, options, onPick, tap, name }: { value: T | null; options: { v: T; label: React.ReactNode; sub?: React.ReactNode; aside?: React.ReactNode; badge?: string }[]; onPick: (v: T) => void; tap: string | null; name: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const i = LETTERS.indexOf(e.key.toUpperCase());
      if (i >= 0 && i < options.length) onPick(options[i].v);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [options, onPick]);
  return (
    <div className="st-choices" role="radiogroup" aria-label={name}>
      {options.map((o, i) => (
        <button key={String(o.v)} role="radio" aria-checked={value === o.v} className="st-choice" onClick={() => onPick(o.v)} data-tap={tap === `${name}:${o.v}` ? "" : undefined} data-enter="pick">
          <span className="st-key">{LETTERS[i]}</span>
          <span className="st-choice-t">
            <b>
              {o.label}
              {o.badge && <em>{o.badge}</em>}
            </b>
            {o.sub && <span>{o.sub}</span>}
          </span>
          {o.aside && <span className="st-choice-a">{o.aside}</span>}
          <span className="st-choice-ck">
            <Check />
          </span>
        </button>
      ))}
    </div>
  );
}

function Field({ label, err, children, hint }: { label: string; err?: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className={`st-field ${err ? "bad" : ""}`}>
      <span className="st-field-l">{label}</span>
      {children}
      {err ? (
        <span className="st-field-e" role="alert">
          {err}
        </span>
      ) : hint ? (
        <span className="st-field-h">{hint}</span>
      ) : null}
    </label>
  );
}

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="st-q-err" role="alert">
      {msg}
    </p>
  );
}

// ---- 1. Move-in date ---------------------------------------------------------------

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const iso = (d: number) => `2026-10-${String(d).padStart(2, "0")}`;
const dayName = (d: number) => new Date(2026, 9, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export function DateStep({ o, tap }: StepProps) {
  const day = Number(o.moveIn.slice(8, 10));
  const q = quote(o);
  const quick = [
    { d: 2, l: "Today" },
    { d: 3, l: "Tomorrow" },
    { d: 5, l: "Monday" },
  ];
  const first = new Date(2026, 9, 1).getDay(); // Thursday
  return (
    <>
      <div className="st-quick">
        {quick.map(x => (
          <button key={x.d} aria-pressed={day === x.d} onClick={() => setOrder({ moveIn: iso(x.d) })} data-tap={tap === `date:${x.d}` ? "" : undefined}>
            <b>{x.l}</b>
            <span>{dayName(x.d)}</span>
          </button>
        ))}
      </div>
      <div className="st-cal">
        <div className="st-cal-h">
          <b>October 2026</b>
          <span className="mono">Reserve up to Oct 31</span>
        </div>
        <div className="st-cal-g">
          {DOW.map((d, i) => (
            <span key={i} className="st-cal-dow">
              {d}
            </span>
          ))}
          {Array.from({ length: first }).map((_, i) => (
            <span key={"p" + i} />
          ))}
          {Array.from({ length: 31 }).map((_, i) => {
            const d = i + 1;
            const past = d < 2;
            return (
              <button key={d} disabled={past} aria-pressed={day === d} className={d === 2 ? "today" : ""} onClick={() => setOrder({ moveIn: iso(d) })} aria-label={dayName(d)}>
                {d}
              </button>
            );
          })}
        </div>
      </div>
      <p className="st-q-note">
        Rent starts {o.moveIn === TODAY_ISO ? "today" : `on ${dayName(day)}`}. October is prorated: <b className="tnum">{money(q.lines[0].amount)}</b> for {q.days} of 31 days.
      </p>
    </>
  );
}

// ---- 2. Duration ------------------------------------------------------------------------

export function DurationStep({ o, errs, tap }: StepProps) {
  return (
    <>
      <Choices
        name="duration"
        tap={tap}
        value={o.duration || null}
        onPick={v => setOrder({ duration: v, plan: v === "6–12 months" || v === "More than a year" ? "prepay" : o.plan })}
        options={[
          { v: "Less than 3 months", label: "Less than 3 months", sub: "Between moves, a renovation" },
          { v: "3–6 months", label: "3 to 6 months", sub: "A season or a long project" },
          { v: "6–12 months", label: "6 to 12 months", sub: "Prepay saves 10%" },
          { v: "More than a year", label: "More than a year", sub: "Prepay saves 10%" },
          { v: "Not sure yet", label: "Not sure yet" },
        ]}
      />
      <Err msg={errs.duration} />
      <p className="st-q-note">It's month to month either way. This only helps us suggest a billing plan.</p>
    </>
  );
}

// ---- 3. Name --------------------------------------------------------------------------------

export function NameStep({ o, errs }: StepProps) {
  return (
    <div className="st-fields st-fields--2">
      <Field label="First name" err={errs.first}>
        <input className="st-in" value={o.first} onChange={e => setOrder({ first: e.target.value })} placeholder={DEFAULTS.first} autoComplete="given-name" autoFocus />
      </Field>
      <Field label="Last name" err={errs.last} hint="As it appears on your ID">
        <input className="st-in" value={o.last} onChange={e => setOrder({ last: e.target.value })} placeholder={DEFAULTS.last} autoComplete="family-name" />
      </Field>
    </div>
  );
}

// ---- 4. Contact ----------------------------------------------------------------------------------

export function ContactStep({ o, errs }: StepProps) {
  return (
    <div className="st-fields">
      <Field label="Email" err={errs.email} hint="For your lease and receipts">
        <input className="st-in" type="email" value={o.email} onChange={e => setOrder({ email: e.target.value })} placeholder={DEFAULTS.email} autoComplete="email" autoFocus />
      </Field>
      <Field label="Mobile" err={errs.phone} hint="Your gate code is sent here by text">
        <input className="st-in tnum" inputMode="tel" value={o.phone} onChange={e => setOrder({ phone: formatPhone(e.target.value) })} placeholder={DEFAULTS.phone} autoComplete="tel" />
      </Field>
    </div>
  );
}

// ---- 5. Protection -----------------------------------------------------------------------------------

export function ProtectionStep({ o, errs, tap }: StepProps) {
  const [progress, setProgress] = useState<number | null>(o.ownFile ? 100 : null);
  const timer = useRef<number>();
  useEffect(() => () => clearInterval(timer.current), []);
  const upload = () => {
    setProgress(0);
    let p = 0;
    clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      p = Math.min(100, p + 9 + Math.random() * 14);
      setProgress(p);
      if (p >= 100) {
        clearInterval(timer.current);
        setOrder({ ownFile: "policy-declarations.pdf" });
      }
    }, 90);
  };
  return (
    <>
      <Choices
        name="protection"
        tap={tap}
        value={o.protection}
        onPick={v => setOrder({ protection: v })}
        options={[
          ...PROTECTION.map(p => ({ v: p.id as Order["protection"], label: `${p.label} · ${p.cover}`, sub: p.note, aside: <span className="tnum">${p.price}/mo</span>, badge: "popular" in p ? "Most chosen" : undefined })),
          { v: "own" as const, label: "I have my own insurance", sub: "Homeowners or renters policy that covers storage", aside: <span>$0</span> },
        ]}
      />
      {o.protection === "own" && (
        <div className="st-own">
          <Field label="Insurance company" err={errs.ownInsurer}>
            <input className="st-in st-in--sm" value={o.ownInsurer} onChange={e => setOrder({ ownInsurer: e.target.value })} placeholder="State Farm, Lemonade, USAA…" autoFocus />
          </Field>
          <div className={`st-drop ${errs.ownFile ? "bad" : ""}`}>
            {progress === null ? (
              <button onClick={upload} data-enter="native">
                <Upload />
                <span>
                  <b>Upload your declarations page</b>
                  <em>PDF or photo · up to 10 MB</em>
                </span>
              </button>
            ) : (
              <div className="st-file">
                <FileText />
                <span>
                  <b>policy-declarations.pdf</b>
                  <em>{progress < 100 ? `Uploading · ${Math.round(progress)}%` : "284 KB · storage coverage found"}</em>
                  <i style={{ width: `${progress}%` }} />
                </span>
                {progress >= 100 && <Check className="ok" />}
              </div>
            )}
          </div>
          {errs.ownFile && <span className="st-field-e">{errs.ownFile}</span>}
        </div>
      )}
      <p className="st-q-note">Covers fire, theft and water while your things are here. Change or cancel it any time.</p>
    </>
  );
}

// ---- 6. Plan -----------------------------------------------------------------------------------------------

export function PlanStep({ o, tap }: StepProps) {
  const u = UNIT_BY_ID.get(o.unitId)!;
  const monthly = quote({ ...o, plan: "monthly" });
  const prepay = quote({ ...o, plan: "prepay" });
  return (
    <>
      <div className="st-plans" role="radiogroup" aria-label="Billing plan">
        <button role="radio" aria-checked={o.plan === "monthly"} className="st-plan" onClick={() => setOrder({ plan: "monthly" })} data-tap={tap === "plan:monthly" ? "" : undefined} data-enter="pick">
          <span className="st-key">A</span>
          <b>Monthly</b>
          <div className="st-plan-p">
            <span className="tnum">${u.rate}</span>
            <small>/mo</small>
          </div>
          <span>Pay as you go. Leave with 10 days' notice.</span>
          <em className="tnum">{money(monthly.dueToday)} today</em>
        </button>
        <button role="radio" aria-checked={o.plan === "prepay"} className="st-plan" onClick={() => setOrder({ plan: "prepay" })} data-tap={tap === "plan:prepay" ? "" : undefined} data-enter="pick">
          <span className="st-key">B</span>
          <b>
            Prepay 6 months <i>−10%</i>
          </b>
          <div className="st-plan-p">
            <span className="tnum">${r2(u.rate * 0.9).toFixed(2)}</span>
            <small>/mo</small>
          </div>
          <span>Covers October through April. Unused months refunded.</span>
          <em className="tnum">{money(prepay.dueToday)} today</em>
        </button>
      </div>
      <PlanKeys />
      <button className={`st-toggle ${o.autopay ? "on" : ""}`} role="switch" aria-checked={o.autopay} onClick={() => setOrder({ autopay: !o.autopay })} data-enter="native">
        <span className="st-switch">
          <i />
        </span>
        <span>
          <b>Autopay on the 1st</b>
          <em>{o.autopay ? `Charges the card you add next. ${o.plan === "prepay" ? `First autopay May 1.` : "First autopay Nov 1."}` : "We'll text a payment link 5 days before each due date."}</em>
        </span>
      </button>
    </>
  );
}

function PlanKeys() {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key.toUpperCase() === "A") setOrder({ plan: "monthly" });
      if (e.key.toUpperCase() === "B") setOrder({ plan: "prepay" });
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return null;
}

// ---- 7. ID --------------------------------------------------------------------------------------------------

export function IdStep({ errs, tap }: StepProps) {
  return (
    <>
      <IdScan autoStart={tap === "scan"} />
      <Err msg={errs.id} />
    </>
  );
}

// ---- 8. Payment ------------------------------------------------------------------------------------------------

export function PaymentStep({ o, errs, tap }: StepProps) {
  const q = quote(o);
  const brand = cardBrand(o.card);
  const [sheet, setSheet] = useState<null | "auth" | "done">(null);
  const exp = useRef(o.exp);
  const apple = () => {
    setSheet("auth");
    window.setTimeout(() => setSheet("done"), 1300);
    window.setTimeout(() => {
      setSheet(null);
      setOrder({ pay: "apple", card: "4242 4242 4242 4242", exp: "08/29", cvc: "314", zip: "96150" });
    }, 2100);
  };
  return (
    <>
      {o.pay === "apple" ? (
        <div className="st-applepaid">
          <Wallet />
          <span>
            <b>Apple Pay ready</b>
            <em>Visa •• 4242 · Maya's iPhone</em>
          </span>
          <button className="st-link" onClick={() => setOrder({ pay: "card", card: "", exp: "", cvc: "", zip: "" })} data-enter="native">
            Use a card instead
          </button>
        </div>
      ) : (
        <>
          <button className="st-apple" onClick={apple} data-enter="native">
            <Wallet /> Pay with Apple Pay
          </button>
          <div className="st-or">
            <span>or pay with a card</span>
          </div>
          <div className="st-card">
            <Field label="Card number" err={errs.card}>
              <div className="st-in-wrap">
                <input className="st-in st-in--sm tnum" inputMode="numeric" value={o.card} onChange={e => setOrder({ card: formatCard(e.target.value) })} placeholder="1234 1234 1234 1234" autoComplete="cc-number" autoFocus />
                <span className={`st-brand-b ${brand ? "on" : ""}`}>{brand ? BRAND_LABEL[brand] : <Lock />}</span>
              </div>
            </Field>
            <div className="st-fields st-fields--3">
              <Field label="Expiry" err={errs.exp}>
                <input
                  className="st-in st-in--sm tnum"
                  inputMode="numeric"
                  value={o.exp}
                  onChange={e => {
                    const v = formatExp(e.target.value, exp.current);
                    exp.current = v;
                    setOrder({ exp: v });
                  }}
                  placeholder="MM/YY"
                  autoComplete="cc-exp"
                />
              </Field>
              <Field label="CVC" err={errs.cvc}>
                <input className="st-in st-in--sm tnum" inputMode="numeric" value={o.cvc} onChange={e => setOrder({ cvc: e.target.value.replace(/\D/g, "").slice(0, brand === "amex" ? 4 : 3) })} placeholder={brand === "amex" ? "1234" : "123"} autoComplete="cc-csc" />
              </Field>
              <Field label="Billing ZIP" err={errs.zip}>
                <input className="st-in st-in--sm tnum" inputMode="numeric" value={o.zip} onChange={e => setOrder({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) })} placeholder="96150" autoComplete="postal-code" />
              </Field>
            </div>
          </div>
        </>
      )}
      <div className="st-due">
        {q.lines.map(l => (
          <div key={l.label} className={l.tone === "discount" ? "disc" : ""}>
            <span>
              {l.label}
              {l.note && <em>{l.note}</em>}
            </span>
            <span className="tnum">{money(l.amount)}</span>
          </div>
        ))}
        <div className="st-due-t">
          <span>Due today</span>
          <span className="tnum">{money(q.dueToday)}</span>
        </div>
        <p>
          Then {money(q.monthly)}/mo from {q.nextCharge}
          {o.autopay ? " on autopay" : ""}. You won't be charged until you sign.
        </p>
      </div>
      {sheet && (
        <div className="st-sheet" role="dialog" aria-label="Apple Pay">
          <div className="st-sheet-in">
            <div className="st-sheet-h">
              <Wallet /> <b>Apple Pay</b>
            </div>
            <div className="st-sheet-r">
              <span>Zonera Alder Lake</span>
              <b className="tnum">{money(q.dueToday)}</b>
            </div>
            <div className="st-sheet-r">
              <span>Card</span>
              <span>Visa •• 4242</span>
            </div>
            <div className={`st-sheet-s ${sheet}`}>
              {sheet === "auth" ? (
                <>
                  <span className="st-faceid" /> Confirm with Face ID
                </>
              ) : (
                <>
                  <Check /> Done
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---- 9. Lease ------------------------------------------------------------------------------------------------------

const AGREEMENT = [
  ["Premises", "Owner rents to Occupant the storage space named on page one for the storage of personal property only. Occupant may not live in, sleep in or run a business open to the public from the space."],
  ["Term", "Month to month, starting on the move-in date. Either party may end this agreement with 10 days' written notice. Rent for the final month is not prorated."],
  ["Rent and fees", "Rent is due in advance on the 1st of each month. A $20 late fee applies to any balance unpaid on the 6th. A $25 fee applies to returned payments."],
  ["Default", "If rent is 30 days past due, Owner may deny access and overlock the space. Owner will follow the notice and sale procedures of the California Self-Service Storage Facility Act (Bus. & Prof. Code §21700 et seq.)."],
  ["Use", "Occupant will not store anything alive, perishable, flammable, explosive, toxic, or illegal, and will keep the space locked with Occupant's own lock."],
  ["Access", "Access is by personal gate code during posted gate hours. Occupant is responsible for every use of their code."],
  ["Protection", "Owner does not insure stored property. Occupant must carry insurance or enroll in a protection plan. Liability is limited as stated in the protection plan addendum."],
  ["Rent changes", "Owner may change rent with at least 30 days' written notice, sent by email and text."],
  ["Entry", "Owner may enter the space with notice for repairs or inspection, or without notice in an emergency."],
  ["Electronic records", "Occupant agrees to sign and receive this agreement and all notices electronically, and may request a paper copy at any time."],
];

export function LeaseStep({ o, errs, tap }: StepProps) {
  const [full, setFull] = useState(false);
  const q = quote(o);
  const u = UNIT_BY_ID.get(o.unitId)!;
  const points: [string, string][] = [
    ["Month to month.", "Leave any time with 10 days' notice. No long-term commitment."],
    [`${money(q.monthly)} a month, due on the 1st.`, o.autopay ? "Autopay charges your card on file. You get a receipt by email." : "We text a payment link 5 days before each due date."],
    ["Late after the 5th.", "A $20 fee on the 6th. After 30 days unpaid, gate access pauses and the unit is overlocked."],
    ["Your lock, your key.", `Only you can open ${u.id}. No living, nothing alive, flammable or perishable.`],
    ["30 days' notice before any rent change.", "By email and text, never as a surprise."],
  ];
  const sig = o.signature.trim();
  return (
    <>
      <ol className="st-lease">
        {points.map(([b, t], i) => (
          <li key={i}>
            <span className="mono">{i + 1}</span>
            <p>
              <b>{b}</b> {t}
            </p>
          </li>
        ))}
      </ol>
      <button className={`st-full-t ${full ? "open" : ""}`} onClick={() => setFull(f => !f)} aria-expanded={full} data-enter="native">
        <FileText /> {full ? "Hide" : "Read"} the full rental agreement <span className="mono">10 sections</span>
        <ChevronDown />
      </button>
      {full && (
        <div className="st-full">
          <h4>Self-storage rental agreement · {u.id}</h4>
          {AGREEMENT.map(([h, t], i) => (
            <p key={h}>
              <b>
                {i + 1}. {h}.
              </b>{" "}
              {t}
            </p>
          ))}
        </div>
      )}
      <div className={`st-sign ${errs.signature ? "bad" : ""}`}>
        <div className="st-sign-pad">
          <span className={`st-sign-v ${sig ? "" : "empty"}`}>{sig || `${o.first} ${o.last}`}</span>
          <i />
          <span className="st-sign-m mono">
            {sig ? `Signed electronically · ${fmt.date("2026-10-02")} · ${clock()}` : "Your signature appears here"}
          </span>
        </div>
        <Field label="Type your full name to sign" err={errs.signature}>
          <input className="st-in st-in--sm" value={o.signature} onChange={e => setOrder({ signature: e.target.value })} placeholder={`${o.first} ${o.last}`} autoComplete="off" autoFocus />
        </Field>
      </div>
      <label className={`st-agree ${errs.agreed ? "bad" : ""}`} data-tap={tap === "agree" ? "" : undefined}>
        <input type="checkbox" checked={o.agreed} onChange={e => setOrder({ agreed: e.target.checked })} />
        <span className="st-cb">
          <Check />
        </span>
        <span>
          I agree to the rental agreement and the {o.protection === "own" ? "proof-of-insurance terms" : "protection plan addendum"}, and to receive notices by email and text.
        </span>
      </label>
      {errs.agreed && <span className="st-field-e">{errs.agreed}</span>}
    </>
  );
}

export const STEP_COPY: Record<StepId, { q: (o: Order) => string; sub?: (o: Order) => string }> = {
  date: { q: () => "When do you want to move in?", sub: o => `${o.unitId} is held for you until then. Gate opens at 6:00 am.` },
  duration: { q: () => "How long do you think you'll need it?" },
  name: { q: () => "What's your name?", sub: () => "It goes on the lease and has to match your ID." },
  contact: { q: o => `Thanks, ${o.first || "there"}. How do we reach you?` },
  protection: { q: () => "How should your things be protected?", sub: () => "Required by the lease. Most renters pick a plan; it's added to your monthly rent." },
  plan: { q: () => "How do you want to pay?" },
  id: { q: () => "Verify your ID", sub: () => "A quick scan replaces the office visit. Nothing is stored on this device." },
  payment: { q: () => "Payment", sub: () => "Charged only when you sign. Then automatically on the 1st." },
  lease: { q: o => `Review and sign, ${o.first || "there"}`, sub: o => `The rental agreement for ${o.unitId}, ${sizeLabel(UNIT_BY_ID.get(o.unitId)!.size)}, in plain language.` },
};

export function PrepayNote({ o }: { o: Order }) {
  if (o.plan !== "prepay") return null;
  return <span>Prepaid {PREPAY_MONTHS + 1} months</span>;
}
