import React, { useState } from "react";
import { ArrowLeft, Lock, Check, ArrowRight } from "lucide-react";
import { go, toast } from "../../state/store";
import { Button, Pill } from "../../ui";
import { fde, useFde, ownerDo } from "../fde/engine";
import { DEAL } from "../fde/data/deal";

// Plan and payment. Test mode: nothing is charged until the free period ends.

export function Billing() {
  useFde();
  const st = fde.items.O11;
  const signed = fde.items.O10?.state === "done";
  const paid = st?.state === "done";
  const [name, setName] = useState("Gail Brennan");
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [exp, setExp] = useState("12 / 29");
  const [cvc, setCvc] = useState("424");
  const [zip, setZip] = useState("96150");
  const units = DEAL.facilities.reduce((a, f) => a + f.units, 0);
  const valid = card.replace(/\D/g, "").length >= 15 && exp.replace(/\D/g, "").length >= 4 && cvc.length >= 3 && zip.length >= 5 && name.trim().length > 1;
  const can = signed && st?.state === "open" && valid;

  function start() {
    if (!can) return;
    ownerDo("O11", "card");
    toast({ title: "Subscription started", body: "Nothing charged today. First invoice $999.00 on Dec 1, 2026.", tone: "ok" });
    go("onboard/home");
  }

  return (
    <div className="ob-page ob-doc-page">
      <div className="ob-back-row">
        <button type="button" className="ob-back" onClick={() => go("onboard/home")}>
          <ArrowLeft size={15} /> Your checklist
        </button>
      </div>
      <div>
        <h1 className="ob-h1">Start your subscription</h1>
        <p className="ob-lede">Nothing is charged today. Your card is kept on file for after the 60 free days.</p>
      </div>

      <div className="ob-bill">
        <section className="ob-box">
          <header className="ob-box-h">
            <h2>Your plan</h2>
            <Pill>From your call · Sep 30</Pill>
          </header>
          <div className="ob-plan-n">
            <b>{DEAL.plan}</b>
            <span>
              <b>$999</b> / month
            </span>
          </div>
          <dl className="ob-dl">
            <div>
              <dt>Facilities</dt>
              <dd>Alder Lake · Dolores · Pier 7</dd>
            </div>
            <div>
              <dt>Units</dt>
              <dd className="mono">{units}</dd>
            </div>
            <div>
              <dt>Covers</dt>
              <dd>Up to 5 facilities</dd>
            </div>
            <div>
              <dt>Free period</dt>
              <dd>60 days, ends {DEAL.trialEnds}</dd>
            </div>
            <div>
              <dt>First invoice</dt>
              <dd>$999.00 on {DEAL.firstInvoice}</dd>
            </div>
            <div>
              <dt>Term</dt>
              <dd>12 months · price locked 24</dd>
            </div>
            <div className="ob-dl-total">
              <dt>Due today</dt>
              <dd className="mono">$0.00</dd>
            </div>
          </dl>
        </section>

        <section className="ob-box">
          <header className="ob-box-h">
            <h2>Payment method</h2>
            <Pill tone="info" dot>
              Test mode
            </Pill>
          </header>

          {paid ? (
            <>
              <div className="ob-paid">
                <span className="ob-check ob-check--lg">
                  <Check size={15} strokeWidth={2.6} />
                </span>
                <div>
                  <b>Subscription started</b>
                  <span>
                    Visa ending 4242 · <span className="mono">{st?.at}</span>
                  </span>
                </div>
              </div>
              <div className="ob-pay-note">
                <b>Nothing charged today.</b>
                <span>First invoice $999.00 on Dec 1, 2026.</span>
              </div>
              <Button variant="primary" className="ob-wide" onClick={() => go("onboard/home")}>
                Back to your checklist <ArrowRight />
              </Button>
            </>
          ) : (
            <>
              <label className="ob-field">
                <span>Name on card</span>
                <input className="ob-input" value={name} onChange={e => setName(e.target.value)} autoComplete="cc-name" />
              </label>
              <label className="ob-field">
                <span>Card number</span>
                <span className="ob-cardnum">
                  <input className="ob-input mono" inputMode="numeric" value={card} onChange={e => setCard(e.target.value)} autoComplete="cc-number" />
                  <em>VISA</em>
                </span>
              </label>
              <div className="ob-grid3">
                <label className="ob-field">
                  <span>Expiry</span>
                  <input className="ob-input mono" value={exp} onChange={e => setExp(e.target.value)} autoComplete="cc-exp" />
                </label>
                <label className="ob-field">
                  <span>CVC</span>
                  <input className="ob-input mono" value={cvc} onChange={e => setCvc(e.target.value)} autoComplete="cc-csc" />
                </label>
                <label className="ob-field">
                  <span>ZIP</span>
                  <input className="ob-input mono" value={zip} onChange={e => setZip(e.target.value)} autoComplete="postal-code" />
                </label>
              </div>

              <div className="ob-pay-note">
                <b>Nothing is charged today.</b>
                <span>First invoice $999.00 on Dec 1, 2026.</span>
              </div>

              {!signed && (
                <div className="ob-gate">
                  <span>Sign the agreement first.</span>
                  <button type="button" className="ob-link" onClick={() => go("onboard/msa")}>
                    Review and sign
                  </button>
                </div>
              )}

              <Button variant="primary" size="lg" className="ob-wide" disabled={!can} onClick={start}>
                Start subscription
              </Button>
              <p className="ob-stripe">
                <Lock size={12} /> Payments processed by Stripe
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
