import type { Order } from "./order";

// Field formatting and the exact messages the checkout shows.

export type Brand = "visa" | "mastercard" | "amex" | "discover" | null;

export function cardBrand(num: string): Brand {
  const d = num.replace(/\D/g, "");
  if (/^4/.test(d)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "mastercard";
  if (/^3[47]/.test(d)) return "amex";
  if (/^(6011|65|64[4-9])/.test(d)) return "discover";
  return null;
}

export const BRAND_LABEL: Record<NonNullable<Brand>, string> = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover" };

export function formatCard(v: string) {
  const d = v.replace(/\D/g, "");
  if (cardBrand(d) === "amex") {
    const x = d.slice(0, 15);
    return [x.slice(0, 4), x.slice(4, 10), x.slice(10)].filter(Boolean).join(" ");
  }
  return d.slice(0, 16).replace(/(.{4})(?=.)/g, "$1 ");
}

export function formatExp(v: string, prev = "") {
  let d = v.replace(/\D/g, "").slice(0, 4);
  if (d.length === 1 && Number(d) > 1) d = "0" + d;
  if (d.length >= 3) return d.slice(0, 2) + "/" + d.slice(2);
  if (d.length === 2 && prev.length < v.length) return d + "/";
  return d;
}

export function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").replace(/^1/, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function luhn(d: string) {
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export function last4(o: Pick<Order, "card">) {
  return o.card.replace(/\D/g, "").slice(-4);
}

export function cardLabel(o: Pick<Order, "card" | "pay">) {
  const b = cardBrand(o.card);
  const name = b ? BRAND_LABEL[b] : "Card";
  return o.pay === "apple" ? `Apple Pay · ${name} •• ${last4(o)}` : `${name} •• ${last4(o)}`;
}

export type Errors = Partial<Record<string, string>>;

export function validateStep(step: string, o: Order): Errors {
  const e: Errors = {};
  if (step === "duration" && !o.duration) e.duration = "Pick the closest answer. You can stay as long as you like either way.";
  if (step === "name") {
    if (!o.first.trim()) e.first = "Enter your first name.";
    if (!o.last.trim()) e.last = "Enter your last name as it appears on your ID.";
  }
  if (step === "contact") {
    if (!o.email.trim()) e.email = "Enter your email for the lease and receipts.";
    else if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(o.email.trim())) e.email = "That email looks incomplete. Use the form name@example.com.";
    const d = o.phone.replace(/\D/g, "");
    if (!d) e.phone = "Enter a mobile number. Your gate code is sent by text.";
    else if (d.length !== 10) e.phone = `Mobile numbers have 10 digits. This one has ${d.length}.`;
  }
  if (step === "protection" && o.protection === "own") {
    if (!o.ownInsurer.trim()) e.ownInsurer = "Enter the name of your insurance company.";
    if (!o.ownFile) e.ownFile = "Upload your declarations page so we can confirm it covers storage.";
  }
  if (step === "id" && !o.idVerified) e.id = "Scan your ID to continue. It takes about ten seconds.";
  if (step === "payment" && o.pay === "card") {
    const d = o.card.replace(/\D/g, "");
    const amex = cardBrand(d) === "amex";
    if (!d) e.card = "Enter your card number.";
    else if (d.length < (amex ? 15 : 16)) e.card = "This card number is incomplete.";
    else if (!luhn(d)) e.card = "That card number isn't valid. Check the digits.";
    const m = /^(\d{2})\/(\d{2})$/.exec(o.exp);
    if (!m) e.exp = "Enter the expiry as MM/YY.";
    else {
      const mm = Number(m[1]);
      const yy = Number(m[2]);
      if (mm < 1 || mm > 12) e.exp = "The month should be 01 to 12.";
      else if (yy < 26 || (yy === 26 && mm < 10)) e.exp = "This card has expired.";
    }
    if (!new RegExp(`^\\d{${amex ? 4 : 3}}$`).test(o.cvc)) e.cvc = amex ? "Enter the 4-digit code on the front." : "Enter the 3-digit code on the back.";
    if (!/^\d{5}$/.test(o.zip)) e.zip = "Enter the 5-digit billing ZIP.";
  }
  if (step === "lease") {
    const want = `${o.first} ${o.last}`.trim().toLowerCase().replace(/\s+/g, " ");
    const got = o.signature.trim().toLowerCase().replace(/\s+/g, " ");
    if (!got) e.signature = "Type your full name to sign.";
    else if (got !== want) e.signature = `Type your name exactly as on the lease: ${o.first} ${o.last}.`;
    if (!o.agreed) e.agreed = "Check the box to accept the rental agreement.";
  }
  return e;
}
