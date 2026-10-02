import React, { useState } from "react";
import { ArrowLeft, Check, Quote as QuoteIcon } from "lucide-react";
import { go, toast } from "../../state/store";
import { Button, Pill } from "../../ui";
import { fde, useFde, ownerDo } from "../fde/engine";
import { DEAL } from "../fde/data/deal";

// The Master Subscription Agreement, generated from what Gail and Jordan agreed on the call.
// Variable terms are highlighted; margin notes say where each one came from.

function Hl({ children }: { children: React.ReactNode }) {
  return <mark className="ob-hl">{children}</mark>;
}

function Note({ when, quote }: { when: string; quote: string }) {
  return (
    <aside className="ob-msa-note">
      <span className="ob-msa-note-l">
        <QuoteIcon size={11} /> {when}
      </span>
      <span className="ob-msa-note-q">“{quote}”</span>
    </aside>
  );
}

function Section({ n, title, note, children }: { n: number; title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="ob-msa-sec">
      <div className="ob-msa-body">
        <h3>
          <span className="mono">{n}.</span> {title}
        </h3>
        {children}
      </div>
      {note ?? <span />}
    </section>
  );
}

export function Agreement() {
  useFde();
  const st = fde.items.O10;
  const signed = st?.state === "done";
  const canSign = st?.state === "open";
  const [name, setName] = useState("");
  const [title, setTitle] = useState("Owner");
  const [agree, setAgree] = useState(false);
  const ready = canSign && name.trim().split(/\s+/).length >= 2 && agree;

  function sign() {
    if (!ready) return;
    ownerDo("O10", name.trim());
    toast({ title: "Agreement signed", body: "A copy is on its way to gail@brennanstorage.com.", tone: "ok" });
    go("onboard/home");
  }

  const signedName = st?.value || "Gail Brennan";
  const units = DEAL.facilities.reduce((a, f) => a + f.units, 0);

  return (
    <div className="ob-page ob-doc-page">
      <div className="ob-back-row">
        <button type="button" className="ob-back" onClick={() => go("onboard/home")}>
          <ArrowLeft size={15} /> Your checklist
        </button>
        {signed ? (
          <Pill tone="ok" dot>
            Signed {st?.at}
          </Pill>
        ) : (
          <span className="ob-legend">
            <mark className="ob-hl">Highlighted</mark> from your call with Jordan
          </span>
        )}
      </div>

      <article className="ob-doc">
        <header className="ob-doc-h">
          <p className="ob-eyebrow">Zonera, Inc. · Order form and agreement</p>
          <h1>Master Subscription Agreement</h1>
          <p className="ob-doc-parties">
            Between <b>Zonera, Inc.</b>, 535 Mission Street, San Francisco, CA 94105 (“Zonera”), and <b>{DEAL.legal}</b>, {DEAL.address} (“you”). Effective on the date you sign below.
          </p>
        </header>

        <section className="ob-msa-sec ob-msa-sec--order">
          <div className="ob-msa-body">
            <h3>Order form</h3>
            <div className="ob-order">
              <table>
                <tbody>
                  <tr>
                    <th>Plan</th>
                    <td>
                      <Hl>Professional</Hl>
                    </td>
                  </tr>
                  <tr>
                    <th>Price</th>
                    <td>
                      <Hl>$999 per month</Hl> for up to <Hl>5 facilities</Hl>
                    </td>
                  </tr>
                  <tr>
                    <th>Facilities</th>
                    <td>
                      {DEAL.facilities.map((f, i) => (
                        <React.Fragment key={f.id}>
                          {i > 0 && " · "}
                          {f.name} <span className="mono">({f.units})</span>
                        </React.Fragment>
                      ))}{" "}
                      = <b className="mono">{units}</b> units
                    </td>
                  </tr>
                  <tr>
                    <th>Free period</th>
                    <td>
                      <Hl>60 days</Hl>, ending <Hl>Nov 30, 2026</Hl>
                    </td>
                  </tr>
                  <tr>
                    <th>First invoice</th>
                    <td>
                      <Hl>Dec 1, 2026</Hl> · $999.00
                    </td>
                  </tr>
                  <tr>
                    <th>Term</th>
                    <td>
                      <Hl>12 months</Hl> from the end of the free period
                    </td>
                  </tr>
                  <tr>
                    <th>Price lock</th>
                    <td>
                      <Hl>24 months</Hl> from the effective date
                    </td>
                  </tr>
                  <tr>
                    <th>Setup and migration</th>
                    <td>Included, no charge</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="ob-msa-notes">
            <Note when="Agreed on your call with Jordan · Sep 30 · 27:02" quote="nine ninety-nine a month… we waive the first sixty days" />
            <Note when="Your call with Jordan · Sep 30 · 27:26" quote="Twelve months, price locked for twenty-four" />
          </div>
        </section>

        <Section n={1} title="Services">
          <p>
            Zonera provides facility management software and AI agents (the “Services”) for the facilities in the order form. The agents answer tenants, take payments, manage gate access and keep
            your records, within the permissions you set.
          </p>
        </Section>

        <Section n={2} title="Your data">
          <p>
            You own your data: tenants, ledgers, documents and gate codes. You can export all of it at any time, in standard formats, at no charge. We use it only to provide the Services to you, and we
            never sell it.
          </p>
        </Section>

        <Section n={3} title="Agent actions">
          <p>Agents act within permission tiers that you control and can change at any time:</p>
          <div className="ob-tiers">
            <div>
              <b>On its own</b>
              <span>Routine work: reminders, receipts, answering questions, gate codes on move-in and move-out.</span>
            </div>
            <div>
              <b>Ask first</b>
              <span>Refunds, rate changes, overlocks and lien steps. You or your manager approve.</span>
            </div>
            <div>
              <b>Never</b>
              <span>Anything you switch off. The agent will say it can't and hand it to you.</span>
            </div>
          </div>
          <p>Any movement of money needs approval under your tiers. Every action is logged with what was done, by which agent, and why. The log is yours to read in your console.</p>
        </Section>

        <Section n={4} title="Fees">
          <p>
            Fees are <Hl>$999 per month</Hl> for up to five facilities, billed monthly in advance starting <Hl>December 1, 2026</Hl>. Nothing is charged during the free period. The price is locked
            for <Hl>24 months</Hl> from the effective date. Taxes are added where they apply.
          </p>
        </Section>

        <Section n={5} title="Term and termination">
          <p>
            The initial term is <Hl>12 months</Hl>, starting when the free period ends. After that it renews month to month until either side gives 30 days' notice. Either side may end the agreement
            for a material breach not fixed within 30 days. If you leave, we help you export everything.
          </p>
        </Section>

        <Section n={6} title="Migration and cutover" note={<Note when="Your call with Jordan · Sep 24 · 12:05" quote="You share a login and we take it from there" />}>
          <p>
            We move your data from {DEAL.legacy}, connect your {DEAL.gate} gate and transfer autopay at no charge. Legacy credentials you share are stored encrypted, used read-only by our migration
            agent, and <Hl>revoked at cutover</Hl>. Nothing goes live until a separate agent has checked every tenant, balance and gate code.
          </p>
        </Section>

        <Section n={7} title="Your lease" note={<Note when="Your call with Jordan · Sep 24 · 14:22" quote="The lien language has to stay exactly as written" />}>
          <p>
            We use your rental agreement (March 2026 revision) <Hl>word for word</Hl>, including its lien language. We don't change its terms. You remain responsible for its legal terms and for
            following California's self-storage lien law.
          </p>
        </Section>

        <Section n={8} title="Confidentiality">
          <p>Each side keeps the other's non-public information confidential and uses it only for this agreement.</p>
        </Section>

        <Section n={9} title="Liability">
          <p>
            Each side's total liability is limited to the fees paid in the 12 months before the claim. Neither side is liable for indirect or consequential losses. These limits don't apply to
            breaches of confidentiality or to fraud.
          </p>
        </Section>

        <section className="ob-sign">
          <div className="ob-sign-party">
            <span className="ob-eyebrow">Zonera, Inc.</span>
            <span className="ob-sig">Jordan Lee</span>
            <span className="ob-sign-meta">Jordan Lee · Growth · Sep 30, 2026</span>
          </div>

          <div className="ob-sign-party ob-sign-party--you">
            <span className="ob-eyebrow">{DEAL.legal}</span>
            {signed ? (
              <>
                <span className="ob-sig">{signedName}</span>
                <span className="ob-sign-meta">
                  {signedName} · Owner · <span className="mono">{st?.at}</span>
                </span>
                <span className="ob-signed">
                  <Check size={14} strokeWidth={2.6} /> Signed. A copy is in your email.
                </span>
              </>
            ) : (
              <>
                <span className={`ob-sig ${name.trim() ? "" : "is-empty"}`}>{name.trim() || "Your signature"}</span>
                <div className="ob-grid2">
                  <label className="ob-field">
                    <span>Full name</span>
                    <input className="ob-input" placeholder="Type your full name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" disabled={!canSign} />
                  </label>
                  <label className="ob-field">
                    <span>Title</span>
                    <input className="ob-input" value={title} onChange={e => setTitle(e.target.value)} disabled={!canSign} />
                  </label>
                </div>
                <label className="ob-agree">
                  <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} disabled={!canSign} />
                  <span>I agree to this agreement and the order form, on behalf of {DEAL.legal}.</span>
                </label>
                <Button variant="primary" size="lg" className="ob-wide" disabled={!ready} onClick={sign}>
                  Sign agreement
                </Button>
                {!canSign && <p className="ob-note">Your agreement is still being prepared. It'll be ready in a moment.</p>}
              </>
            )}
          </div>
        </section>
      </article>
    </div>
  );
}
