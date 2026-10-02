import React from "react";
import { Lock } from "lucide-react";
import type { Brand } from "./types";

// Payment primitives shared by the money widgets: card brand detection and
// formatting, Luhn check, Stripe-style ids, brand marks (monochrome, drawn
// here so they follow the theme), "Powered by Stripe", check amount in words.

export function detectBrand(raw: string): Brand | null {
  const n = raw.replace(/\D/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^(6011|65|64[4-9])/.test(n)) return "Discover";
  return null;
}

export const cardLength = (b: Brand | null) => (b === "Amex" ? 15 : 16);
export const cvcLength = (b: Brand | null) => (b === "Amex" ? 4 : 3);

export function formatCard(raw: string) {
  const b = detectBrand(raw);
  const n = raw.replace(/\D/g, "").slice(0, cardLength(b));
  if (b === "Amex") return [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)].filter(Boolean).join(" ");
  return n.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function formatExp(raw: string, prev = "") {
  let n = raw.replace(/\D/g, "").slice(0, 4);
  if (n.length === 1 && +n > 1) n = "0" + n;
  // Deleting the slash deletes the month digit too.
  if (prev.endsWith(" / ") && raw.length < prev.length) return n.slice(0, 1);
  if (n.length >= 2) return n.slice(0, 2) + " / " + n.slice(2);
  return n;
}

export function luhn(raw: string) {
  const n = raw.replace(/\D/g, "");
  let sum = 0;
  for (let i = 0; i < n.length; i++) {
    let d = +n[n.length - 1 - i];
    if (i % 2) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return n.length >= 13 && sum % 10 === 0;
}

/** True if "MM / YY" is a real month that hasn't passed (demo day: Oct 2026). */
export function expValid(exp: string) {
  const m = /^(\d{2}) \/ (\d{2})$/.exec(exp);
  if (!m) return false;
  const mm = +m[1];
  const yy = +m[2];
  if (mm < 1 || mm > 12) return false;
  return yy > 26 || (yy === 26 && mm >= 10);
}

export const cardLabel = (b: Brand, last4: string) => `${b} •• ${last4}`;

export function parseCardLabel(label?: string): { brand: Brand; last4: string } | null {
  const m = /^(Visa|Mastercard|Amex|Discover)\s*••\s*(\d{4})/.exec(label ?? "");
  return m ? { brand: m[1] as Brand, last4: m[2] } : null;
}

// ---- ids --------------------------------------------------------------------

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
let idSeed = 0x5eed1e;
function rand() {
  idSeed = (idSeed + 0x6d2b79f5) >>> 0;
  let t = idSeed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** Stripe-shaped ids: pi_3Q…, ch_3Q…, re_3Q…, pm_1Q…, po_1Q…, tmr_… */
export function stripeId(prefix: "pi" | "ch" | "re" | "pm" | "po" | "tmr" | "env" | "seti" | "cus", len = 24) {
  let s = "";
  for (let i = 0; i < len; i++) s += B62[Math.floor(rand() * 62)];
  const head = prefix === "pm" || prefix === "po" || prefix === "cus" ? "1Q" : prefix === "tmr" || prefix === "env" ? "" : "3Q";
  return `${prefix}_${head}${s.slice(head.length)}`;
}
export const shortId = (id: string) => (id.length > 16 ? id.slice(0, 12) + "…" + id.slice(-4) : id);

/** Stable customer id per tenant. */
export function customerId(key: string) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  let s = "";
  for (let i = 0; i < 14; i++) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    s += B62[h % 62];
  }
  return "cus_" + s;
}

// ---- marks --------------------------------------------------------------------

export function BrandMark({ brand, dim, size = "md" }: { brand: Brand | null; dim?: boolean; size?: "sm" | "md" }) {
  const cls = `agm-brand agm-brand--${size} ${dim ? "is-dim" : ""}`;
  if (!brand)
    return (
      <span className={cls} aria-hidden>
        <svg viewBox="0 0 24 16" width="18" height="12">
          <rect x="1" y="1.5" width="22" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <rect x="1" y="4.5" width="22" height="2.4" fill="currentColor" />
        </svg>
      </span>
    );
  if (brand === "Mastercard")
    return (
      <span className={cls} title="Mastercard">
        <svg viewBox="0 0 26 16" width="22" height="14" aria-hidden>
          <circle cx="9.5" cy="8" r="6" fill="currentColor" opacity=".9" />
          <circle cx="16.5" cy="8" r="6" fill="currentColor" opacity=".45" />
        </svg>
      </span>
    );
  return (
    <span className={cls} title={brand}>
      <b>{brand === "Visa" ? "VISA" : brand === "Amex" ? "AMEX" : "DISC"}</b>
    </span>
  );
}

export function BrandRow({ active }: { active: Brand | null }) {
  const all: Brand[] = ["Visa", "Mastercard", "Amex", "Discover"];
  if (active) return <BrandMark brand={active} />;
  return (
    <span className="agm-brands">
      {all.map(b => (
        <BrandMark key={b} brand={b} dim size="sm" />
      ))}
    </span>
  );
}

export function PoweredByStripe({ extra }: { extra?: React.ReactNode }) {
  return (
    <div className="agm-stripe-by">
      <Lock />
      <span>
        Powered by <b className="agm-stripe-wm">stripe</b>
      </span>
      {extra && <span className="agm-stripe-x">{extra}</span>}
    </div>
  );
}

// ---- words --------------------------------------------------------------------

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function words(n: number): string {
  if (n === 0) return "zero";
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + words(n % 100) : "");
  return words(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + words(n % 1000) : "");
}
/** "One hundred ninety-five and 00/100" */
export function amountInWords(n: number) {
  const d = Math.floor(n + 1e-9);
  const c = Math.round((n - d) * 100);
  const w = words(d);
  return w.charAt(0).toUpperCase() + w.slice(1) + ` and ${String(c).padStart(2, "0")}/100`;
}

export const r2 = (n: number) => Math.round(n * 100) / 100;
export const usd = (n: number) => (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
