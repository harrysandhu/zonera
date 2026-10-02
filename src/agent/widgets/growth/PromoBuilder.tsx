import React, { useState } from "react";
import { Tag, Check, Truck, Lock, Ruler, ArrowRight } from "lucide-react";
import { Button } from "../../../ui";
import { UNIT_BY_ID } from "../../../data/facility";
import { defineWidget, Frame, stateOf, Toggle } from "../frame";
import { fmtValue, sizeLabel } from "./format";
import type { PromoBuilderAnswer, PromoBuilderProps, PromoEndRule, PromoOfferOption, PromoSizeOption } from "./types";

// W35 · Offer, eligible sizes, conditions, end rule, and the storefront card the
// badge will sit on. The projection (rentals a week, weeks to the goal, cost)
// updates as the operator edits. Movie mode: "offer:<id>", "size:<id>",
// "cond:<id>", "end:<id>", then "submit".

const DAY = 86400000;
const TODAY = new Date(2026, 9, 2, 12);
const dateIn = (weeks: number) => new Date(TODAY.getTime() + Math.round(weeks * 7) * DAY).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function projectPromo(offer: PromoOfferOption, sizes: PromoSizeOption[], rule: PromoEndRule) {
  const weekly = sizes.reduce((s, z) => s + z.baseWeekly * offer.lift, 0) || 0.01;
  const costPer = (z: PromoSizeOption) => Math.max(0, offer.cost.share * z.rate + offer.cost.flat);
  const avgCost = sizes.length ? sizes.reduce((s, z) => s + costPer(z) * z.baseWeekly, 0) / Math.max(0.01, sizes.reduce((s, z) => s + z.baseWeekly, 0)) : 0;
  const avgRate = sizes.length ? sizes.reduce((s, z) => s + z.rate, 0) / sizes.length : 0;
  let rentals: number;
  let weeks: number;
  if (rule.goal !== undefined) {
    rentals = sizes.reduce((s, z) => s + Math.max(0, Math.ceil(rule.goal! * z.total) - z.occupied), 0);
    weeks = rentals / weekly;
  } else if (rule.count !== undefined) {
    rentals = rule.count;
    weeks = rentals / weekly;
  } else {
    weeks = rule.weeks ?? 4;
    rentals = Math.round(weekly * weeks);
  }
  const vacant = sizes.reduce((s, z) => s + z.vacant, 0);
  rentals = Math.min(rentals, vacant);
  return { weekly, weeks, rentals, cost: Math.round(rentals * avgCost), costPer: Math.round(avgCost), monthly: Math.round(rentals * avgRate) };
}

export const PromoBuilder = defineWidget<PromoBuilderProps, PromoBuilderAnswer>(function PromoBuilder(w) {
  const { p, active, answer } = w;
  const [offerId, setOffer] = useState(answer?.offer ?? p.offer);
  const [sel, setSel] = useState<string[]>(answer?.sizes ?? p.selected);
  const [conds, setConds] = useState<string[]>(answer?.conditions ?? p.conditions.filter(c => c.on).map(c => c.id));
  const [endId, setEnd] = useState(answer?.endRule ?? p.endRule);
  const offer = p.offers.find(o => o.id === offerId) ?? p.offers[0];
  const rule = p.endRules.find(r => r.id === endId) ?? p.endRules[0];
  const sizes = p.sizes.filter(s => sel.includes(s.id));
  const proj = projectPromo(offer, sizes, rule);
  const lead = sizes[0] ?? p.sizes[0];
  const unit = UNIT_BY_ID.get(p.preview.unitId);
  const toggle = (id: string, list: string[], set: (v: string[]) => void) => set(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  const summary = answer?.action === "cancel" ? "Not published" : `${offer.badge} · ${sizes.map(s => s.label).join(", ")} · ${rule.label.toLowerCase()}`;

  return (
    <Frame
      icon={<Tag />}
      title={p.title ?? "Promotion"}
      meta="Storefront · Alder Lake"
      tier="Ask first"
      {...stateOf(w, summary)}
      className="agg-promo-w"
      foot={
        <>
          <Button data-auto="cancel" disabled={!active} onClick={() => w.respond({ action: "cancel", offer: offer.id, badge: offer.badge, sizes: sel, conditions: conds, endRule: rule.id, endLabel: rule.label, weeks: proj.weeks, rentals: proj.rentals, cost: proj.cost })}>
            Cancel
          </Button>
          <Button
            variant="primary"
            data-auto="submit"
            disabled={!active || !sel.length}
            onClick={() => w.respond({ action: "publish", offer: offer.id, badge: offer.badge, sizes: sel, conditions: conds, endRule: rule.id, endLabel: rule.label, weeks: proj.weeks, rentals: proj.rentals, cost: proj.cost })}
          >
            Review and publish
          </Button>
        </>
      }
    >
      <div className="agg-promo">
        <div className="agg-promo-form">
          <div className="agg-field">
            <span className="agg-lbl">Offer</span>
            <div className="agg-chips">
              {p.offers.map(o => (
                <button key={o.id} type="button" className="agg-chip" aria-pressed={o.id === offer.id} data-auto={`offer:${o.id}`} disabled={!active} onClick={() => setOffer(o.id)}>
                  {o.id === offer.id && <Check />}
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="agg-field">
            <span className="agg-lbl">Eligible sizes</span>
            <div className="agg-sizes">
              {p.sizes.map(s => {
                const picked = sel.includes(s.id);
                const occ = s.occupied / Math.max(1, s.total);
                return (
                  <button key={s.id} type="button" className="agg-size" aria-pressed={picked} data-auto={`size:${s.id}`} disabled={!active} onClick={() => toggle(s.id, sel, setSel)}>
                    <span className="agg-size-h">
                      <b>{s.label}</b>
                      <span className="mono">${s.rate}</span>
                    </span>
                    <span className="agg-meter" aria-hidden>
                      <i style={{ width: `${occ * 100}%` }} />
                    </span>
                    <span className="agg-size-f mono">
                      {(occ * 100).toFixed(0)}% · {s.vacant} open
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="agg-field">
            <span className="agg-lbl">Conditions</span>
            <div className="agg-conds">
              {p.conditions.map(c => (
                <Toggle key={c.id} auto={`cond:${c.id}`} on={conds.includes(c.id)} disabled={!active} onChange={() => toggle(c.id, conds, setConds)} label={c.hint ? <>{c.label} <small>{c.hint}</small></> : c.label} />
              ))}
            </div>
          </div>

          <div className="agg-field">
            <span className="agg-lbl">Ends</span>
            <div className="agg-chips">
              {p.endRules.map(r => (
                <button key={r.id} type="button" className="agg-chip" aria-pressed={r.id === rule.id} data-auto={`end:${r.id}`} disabled={!active} onClick={() => setEnd(r.id)}>
                  {r.id === rule.id && <Check />}
                  {r.label}
                </button>
              ))}
            </div>
            {rule.detail && <small className="agg-hint">{rule.detail}</small>}
          </div>

          <div className="agg-proj">
            <div>
              <span className="agg-lbl">Pace</span>
              <b className="tnum">{proj.weekly.toFixed(1)}</b>
              <small>rentals a week, from {sizes.reduce((s, z) => s + z.baseWeekly, 0).toFixed(1)}</small>
            </div>
            <div>
              <span className="agg-lbl">{rule.goal !== undefined ? `${Math.round(rule.goal * 100)}% by` : "Ends"}</span>
              <b className="tnum">{sel.length ? dateIn(proj.weeks) : "—"}</b>
              <small>{sel.length ? `${fmtValue(proj.weeks, "weeks")} · ${proj.rentals} rentals` : "Pick a size"}</small>
            </div>
            <div>
              <span className="agg-lbl">Cost</span>
              <b className="tnum">{fmtValue(proj.cost, "money")}</b>
              <small>{fmtValue(proj.costPer, "money")} a rental</small>
            </div>
            <div>
              <span className="agg-lbl">Adds</span>
              <b className="tnum">{fmtValue(proj.monthly, "money")}</b>
              <small>a month in rent once filled</small>
            </div>
          </div>
        </div>

        <div className="agg-promo-prev">
            <span className="agg-lbl">Storefront preview</span>
            <div className="agg-card">
              <div className="agg-card-img">
                <span className="agg-badge" key={offer.id}>
                  {offer.badge}
                </span>
                <UnitSketch size={lead.id} />
              </div>
              <div className="agg-card-b">
                <div className="agg-card-t">
                  <b>{sizeLabel(lead.id)}</b>
                  <span className="mono">{unit?.id ?? p.preview.unitId}</span>
                </div>
                <div className="agg-card-p">
                  <span className="agg-card-was tnum">${lead.rate}/mo</span>
                  <span className="agg-card-now">{offerLine(offer, lead.rate)}</span>
                </div>
                <ul className="agg-card-f">
                  {p.preview.features.map((f, i) => (
                    <li key={f}>
                      {[<Truck key="t" />, <Lock key="l" />, <Ruler key="r" />][i % 3]}
                      {f}
                    </li>
                  ))}
                </ul>
                <span className="agg-card-cta">
                  Rent this unit <ArrowRight />
                </span>
              </div>
            </div>
            <small className="agg-hint">{rule.goal !== undefined ? `The badge comes off by itself when ${sizes.map(s => s.label).join(" and ") || "the size"} reach ${Math.round(rule.goal * 100)}%.` : rule.until ? `The badge comes off on ${rule.until}.` : "The badge comes off when the rule is met."}</small>
        </div>
      </div>
    </Frame>
  );
});

function offerLine(o: PromoOfferOption, rate: number) {
  const first = Math.max(0, rate - Math.max(0, o.cost.share * rate + o.cost.flat));
  return `First month $${first % 1 ? first.toFixed(2) : first}, then $${rate}/mo`;
}

/** A quiet isometric sketch of a roll-up door, scaled by size. */
function UnitSketch({ size }: { size: string }) {
  const [a, b] = size.split("x").map(Number);
  const wide = Math.min(1, (a * b) / 300);
  const dw = 54 + wide * 40;
  return (
    <svg viewBox="0 0 220 120" className="agg-sketch" aria-hidden>
      <path d="M20 96 L200 96" className="agg-sk-ground" />
      <rect x={110 - dw / 2 - 18} y="26" width={dw + 36} height="70" rx="3" className="agg-sk-wall" />
      <rect x={110 - dw / 2} y="38" width={dw} height="58" rx="2" className="agg-sk-door" />
      {Array.from({ length: 7 }).map((_, i) => (
        <line key={i} x1={110 - dw / 2 + 4} x2={110 + dw / 2 - 4} y1={46 + i * 7} y2={46 + i * 7} className="agg-sk-slat" />
      ))}
      <rect x={106} y={88} width="8" height="4" rx="1" className="agg-sk-handle" />
    </svg>
  );
}
