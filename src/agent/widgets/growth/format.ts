import { useEffect, useRef, useState } from "react";
import type { ValueFormat } from "./types";

// Number formatting shared by the growth widgets. Minus signs are real minus
// signs (−) so columns of deltas line up.

const M = "−";
const money = (n: number, cents = false) => (n < 0 ? M : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
const sign = (n: number) => (n > 0 ? "+" : n < 0 ? M : "±");

export function fmtValue(v: number, f: ValueFormat): string {
  switch (f) {
    case "money":
      return money(Math.round(v));
    case "money2":
      return money(v, true);
    case "signedMoney":
      return sign(Math.round(v)) + money(Math.abs(Math.round(v))).replace(M, "");
    case "pct":
      return (v * 100).toFixed(1) + "%";
    case "signedPct":
      return sign(v) + Math.abs(v * 100).toFixed(1) + "%";
    case "pts":
      return sign(v) + Math.abs(v * 100).toFixed(1) + " pt";
    case "int":
      return Math.round(v).toLocaleString("en-US");
    case "signedInt":
      return sign(Math.round(v)) + Math.abs(Math.round(v)).toLocaleString("en-US");
    case "dec1":
      return v.toFixed(1);
    case "signedDec1":
      return sign(v) + Math.abs(v).toFixed(1);
    case "weeks":
      return v >= 52 ? "52+ wk" : `${Math.max(1, Math.round(v))} wk`;
  }
}

export const sizeLabel = (s: string) => s.replace("x", "×");

/** Width of an element, kept in sync with a ResizeObserver. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    setW(Math.round(ref.current.getBoundingClientRect().width));
    const ro = new ResizeObserver(e => setW(Math.round(e[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Round, readable axis ticks. */
export function niceTicks(min: number, max: number, count = 4) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) ?? step0;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(6));
  return out;
}

export const shortMoney = (v: number) => (Math.abs(v) >= 1000 ? "$" + (v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : "$" + Math.round(v));
