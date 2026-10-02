import React from "react";
import { ArrowLeft, Download, Send, FilePlus2, CalendarX, Sparkles, FileText, ShieldCheck, Phone, BellRing, Check, Clock, Fingerprint, ArrowUpRight } from "lucide-react";
import { Button, Pill, type Tone } from "../../../ui";
import { Section, KV } from "../../kit";
import { askAgent, go, toast, useDemo } from "../../../state/store";
import { FACILITY, UNIT_BY_ID, SIZE_INFO } from "../../../data/facility";
import { OPERATOR, TENANT_BY_ID } from "../../../data/tenants";
import { LATE_FEE, longDate, fmtMin, ordinal, TODAY, shortDate } from "../../../data/ledger";
import { remindSigner, logLease, REMINDED, type Lease } from "../../../data/leases";
import { addComm } from "../../../data/comms";
import { startOutboundCall } from "../../../calls/api";
import { useTenantActions } from "./actions";
import { money, AgentBox } from "./ui";

export const LEASE_TONE: Record<Lease["status"], Tone> = { active: "ok", pending: "warn", ending: "violet", ended: "neutral" };
export const LEASE_LABEL: Record<Lease["status"], string> = { active: "Active", pending: "Pending signature", ending: "Ending", ended: "Ended" };

export function LeaseView({ lease }: { lease: Lease }) {
  useDemo();
  const t = lease.tenantId ? TENANT_BY_ID.get(lease.tenantId) : undefined;
  const acts = useTenantActions(t);
  const u = UNIT_BY_ID.get(lease.unitId);
  const size = u ? SIZE_INFO[u.size] : undefined;
  const pending = lease.status === "pending";
  const kindText = u?.kind === "climate" ? `climate-controlled unit on floor ${u.floor} of Building D` : u?.kind === "parking" ? "uncovered RV and boat parking space in the north lot" : `drive-up unit in Building ${u?.building}, door facing ${u?.facing}`;
  const statusLabel = lease.status === "ending" ? `Ending ${shortDate(lease.end!)}` : lease.status === "ended" ? `Ended ${shortDate(lease.end!)}` : LEASE_LABEL[lease.status];

  const summary = pending
    ? [
        `${lease.first} is renting ${lease.unitId}, a ${u?.size.replace("x", "×")} ${u?.kind === "climate" ? "climate unit" : "drive-up"}, month to month from ${longDate(lease.start)} for ${money(lease.rent)} a month including ${lease.plan} protection.`,
        `Sent ${lease.sent!.date === TODAY ? `today at ${fmtMin(lease.sent!.min)}` : longDate(lease.sent!.date)}${lease.viewed ? `, opened ${longDate(lease.viewed.date)} on ${lease.viewed.device}` : ", not opened yet"}. The unit is held until it's signed.`,
      ]
    : [
        `${lease.first} rents ${lease.unitId} month to month for ${money(lease.rent)} (${money(lease.base)} rent + ${money(lease.premium)} ${lease.plan.toLowerCase()} protection), due the ${ordinal(lease.billingDay)}. A $${LATE_FEE} late fee applies after 5 days.`,
        `Either side can end it with written notice. We can deny gate access while rent is past due and, after 14 days, start the lien process under the California Self-Service Storage Facility Act. Rent changes need 30 days' written notice.`,
        lease.status === "ending" || lease.status === "ended" ? `Move-out ${lease.status === "ended" ? "completed" : "scheduled"} for ${longDate(lease.end!)}.` : "",
      ].filter(Boolean);

  const send = () => {
    if (t) addComm(t.id, { channel: "email", dir: "out", who: OPERATOR.name, subject: "Your rental agreement", body: `A copy of your signed rental agreement for ${lease.unitId} (${lease.number}) is attached.`, status: "Delivered" });
    logLease(lease.key, { text: "Copy sent to occupant", who: OPERATOR.name, meta: lease.email });
    toast({ title: "Copy sent", body: `${lease.number} to ${lease.email}`, tone: "ok" });
  };

  return (
    <div className="ok-page ok-page--wide pb-lease">
      <button className="pb-back" onClick={() => go("ops/leases")}>
        <ArrowLeft size={14} /> Leases
      </button>
      <header className="pb-lease-h">
        <div>
          <div className="pb-prof-name">
            <h1>{lease.name}</h1>
            <Pill tone={LEASE_TONE[lease.status]} dot>{statusLabel}</Pill>
          </div>
          <p className="pb-lease-sub">
            <span className="mono">{lease.number}</span> · <span className="mono">{lease.unitId}</span> · {size?.label} {u?.kind === "climate" ? "climate" : u?.kind === "parking" ? "parking" : "drive-up"} · {money(lease.rent)}/mo
            {t && (
              <>
                {" · "}
                <button className="pb-link" onClick={() => go("ops/tenants/" + t.id)}>Customer profile</button>
              </>
            )}
          </p>
        </div>
        <div className="pb-prof-act">
          <button className="ok-ask" onClick={() => askAgent(`Explain ${lease.name}'s lease for ${lease.unitId} in plain language`)}>
            <Sparkles size={14} />
            <span>Ask Zonera about this lease</span>
          </button>
          <Button icon={<Download />} onClick={() => toast({ title: "PDF ready", body: `${lease.number}.pdf · signed copy with certificate`, tone: "info" })}>
            PDF
          </Button>
          {pending ? (
            <Button variant="primary" icon={<BellRing />} onClick={() => (remindSigner(lease), toast({ title: "Reminder sent", body: `${lease.name} · SMS and email`, tone: "ok" }))}>
              Send reminder
            </Button>
          ) : (
            <Button variant="primary" icon={<Send />} onClick={send} disabled={lease.status === "ended"}>
              Send copy
            </Button>
          )}
        </div>
      </header>

      <div className="pb-lease-grid">
        <article className="pb-doc" aria-label="Rental agreement">
          <div className="pb-doc-top">
            <div>
              <div className="pb-doc-brand">zonera</div>
              <div className="pb-doc-fac">
                {FACILITY.name}
                <br />
                {FACILITY.address}
                <br />
                {FACILITY.phone}
              </div>
            </div>
            <div className="pb-doc-no">
              <span>Agreement</span>
              <b className="mono">{lease.number}</b>
              <span>Dated</span>
              <b>{longDate(lease.start)}</b>
            </div>
          </div>
          <h2 className="pb-doc-title">Self-Service Storage Rental Agreement</h2>
          <p className="pb-doc-lede">This agreement is made between the owner and the occupant named below for the rental of storage space at the facility. Please read it carefully. It contains a lien notice required by California law.</p>

          <ol className="pb-clauses">
            <li>
              <h3>Parties</h3>
              <p>
                <b>Owner:</b> Zonera Alder Lake LLC, operating {FACILITY.name}, {FACILITY.address} ("Owner"). <b>Occupant:</b> {lease.name}
                {lease.business ? `, on behalf of ${lease.business}` : ""}, {lease.address}, {lease.phone}, {lease.email} ("Occupant").
              </p>
              <p>
                <b>Alternate contact for notices:</b> {lease.alt.name}
                {lease.alt.rel ? ` (${lease.alt.rel.toLowerCase()}), ${lease.alt.address}, ${lease.alt.phone}` : ""}. Occupant agrees to tell Owner in writing of any change to either address.
              </p>
            </li>
            <li>
              <h3>Premises</h3>
              <p>
                Unit <b className="mono">{lease.unitId}</b>, a {size?.label} ({size?.sqft || (u ? u.w * u.d : 0)} sq ft) {kindText} (the "Premises"). Occupant has inspected the Premises and accepts them as is. The Premises are for storage only; Owner does not take custody of, or provide care for, anything stored.
              </p>
            </li>
            <li>
              <h3>Term</h3>
              <p>
                Month to month, beginning <b>{longDate(lease.start)}</b>
                {lease.end ? <>, ending <b>{longDate(lease.end)}</b> per notice to vacate dated {longDate(lease.noticeDate ?? lease.start)}</> : ""}. The agreement renews automatically each month until either party ends it under section 10.
              </p>
            </li>
            <li>
              <h3>Rent and due date</h3>
              <table className="pb-doc-t">
                <tbody>
                  <tr><td>Monthly rent</td><td className="tnum">{money(lease.base, true)}</td></tr>
                  <tr><td>Tenant protection · {lease.plan}</td><td className="tnum">{money(lease.premium, true)}</td></tr>
                  <tr className="tot"><td>Total due each month</td><td className="tnum">{money(lease.rent, true)}</td></tr>
                  <tr><td>Administrative fee, one time at move-in</td><td className="tnum">$25.00</td></tr>
                </tbody>
              </table>
              <p>
                Rent is due in advance on the <b>{ordinal(lease.billingDay)} day of each month</b>. {lease.autopay ? <>Occupant authorizes automatic payment from {lease.card ?? "the card on file"} on each due date (Autopay addendum).</> : <>Occupant may pay online, by card, cash, check or bank transfer.</>} Owner will give at least 30 days' written notice before any change in rent.
              </p>
            </li>
            <li>
              <h3>Late fees and charges</h3>
              <p>
                If rent is not received within five (5) days of the due date, a late fee of <b>${LATE_FEE}.00</b> is charged. A returned payment fee of $25.00 applies to any declined or returned payment. Payments are applied to the oldest charges first.
              </p>
            </li>
            <li>
              <h3>Access</h3>
              <p>
                Occupant may enter the facility during gate hours, {FACILITY.gateHours}, using a personal gate code that must not be shared. If any amount is past due, Owner may deny Occupant access to the facility and place its own lock on the Premises (overlock) until the account is paid in full. Owner may enter the Premises with notice for inspection, repairs or as required by law, or without notice in an emergency.
              </p>
            </li>
            <li>
              <h3>Tenant protection</h3>
              <p>
                {lease.protection ? (
                  <>Occupant elected the <b>{lease.plan}</b> tenant protection plan, covering up to <b>{money(lease.protection)}</b> of stored property against fire, theft, water and pests, for {money(lease.premium, true)} per month, under the separate protection addendum. Tenant protection is not insurance.</>
                ) : (
                  <>Occupant declined tenant protection and confirms that stored property is insured by Occupant or stored at Occupant's own risk. Owner is not liable for loss of or damage to stored property except as caused by Owner's negligence.</>
                )}{" "}
                Occupant agrees not to store property worth more than $5,000 in total without written consent.
              </p>
            </li>
            <li>
              <h3>Use restrictions</h3>
              <p>Occupant will not store or use the Premises for:</p>
              <ul>
                <li>flammable, explosive, toxic or hazardous materials, fuel (other than in a vehicle's tank), firearms or ammunition;</li>
                <li>food, perishables, plants or live animals;</li>
                <li>living or sleeping, or any business open to the public{lease.business ? " (business storage of inventory and equipment is permitted under the business use addendum)" : ""};</li>
                <li>anything illegal, or anything that creates a nuisance for other occupants.</li>
              </ul>
              {u?.kind === "parking" && <p>Vehicles and watercraft must be registered and insured, and title holders disclosed to Owner.</p>}
            </li>
            <li className="pb-clause-lien">
              <h3>Lien notice · California Self-Service Storage Facility Act</h3>
              <p className="pb-doc-notice">
                NOTICE: THE OWNER OF THIS FACILITY HAS A LIEN ON ALL PERSONAL PROPERTY STORED WITHIN THE PREMISES FOR RENT, LABOR, OR OTHER CHARGES, AND FOR EXPENSES REASONABLY INCURRED IN ITS SALE, AS PROVIDED IN THE CALIFORNIA SELF-SERVICE STORAGE FACILITY ACT, BUSINESS AND PROFESSIONS CODE SECTIONS 21700–21716. THE STORED PROPERTY MAY BE SOLD TO SATISFY THE LIEN IF OCCUPANT IS IN DEFAULT.
              </p>
              <p>
                If any rent or other charge remains unpaid for 14 consecutive days, Owner may terminate Occupant's right to use the Premises by sending a preliminary lien notice to Occupant's last known address and the alternate address above (§21703). If the amount due is not paid by the date in that notice, Owner may send a notice of lien sale and sell the stored property at a public sale, which may be held online (§§21705, 21707). Occupant may contest the sale by returning a declaration in opposition (§21706). Any surplus from a sale is held for Occupant as the Act provides.
              </p>
              <p>Occupant must disclose in writing any lienholder with an interest in property stored in the Premises, and any vehicle or watercraft stored.</p>
            </li>
            <li>
              <h3>Termination and move-out</h3>
              <p>
                Either party may end this agreement by written notice (email or the Zonera app counts) at least 10 days before the next due date. Occupant must remove all property and Occupant's lock and leave the Premises broom-clean by the move-out date. Rent is not prorated for a partial month unless Owner agrees in writing. Property left after move-out may be treated as abandoned under California law.
              </p>
            </li>
            <li>
              <h3>Notices and electronic signature</h3>
              <p>
                Occupant agrees to receive notices, statements and receipts by email and SMS at the contacts above, except where the law requires mail. Both parties agree this agreement may be signed electronically and that an electronic signature has the same effect as a handwritten one. This document, its addenda and the e-sign certificate are the entire agreement.
              </p>
            </li>
          </ol>

          <div className="pb-sigs">
            <div className="pb-sig">
              <span className="pb-sig-l">Occupant</span>
              {lease.signed ? (
                <>
                  <span className="pb-sig-s">{lease.name}</span>
                  <span className="pb-sig-m">
                    {lease.name} · signed electronically {longDate(lease.signed.date)} at {fmtMin(lease.signed.min)} PT
                    <br />
                    <span className="mono">IP {lease.signed.ip} · {lease.signed.device}</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="pb-sig-s pb-sig-s--empty">
                    <Clock size={14} /> Awaiting signature
                  </span>
                  <span className="pb-sig-m">
                    {lease.name} · sent {lease.sent!.date === TODAY ? `today at ${fmtMin(lease.sent!.min)}` : longDate(lease.sent!.date)} to {lease.email}
                  </span>
                </>
              )}
            </div>
            <div className="pb-sig">
              <span className="pb-sig-l">Owner</span>
              {lease.countersigned ? (
                <>
                  <span className="pb-sig-s">{lease.countersigned.who.startsWith("Zonera") ? "Zonera Alder Lake" : OPERATOR.name}</span>
                  <span className="pb-sig-m">
                    {lease.countersigned.who} · {longDate(lease.countersigned.date)} at {fmtMin(lease.countersigned.min)} PT
                  </span>
                </>
              ) : (
                <>
                  <span className="pb-sig-s pb-sig-s--empty">
                    <Clock size={14} /> Countersigns automatically
                  </span>
                  <span className="pb-sig-m">Zonera agent for Zonera Alder Lake, after the occupant signs</span>
                </>
              )}
            </div>
          </div>
          <div className="pb-doc-foot mono">
            <span>
              <Fingerprint size={12} /> SHA-256 {lease.hash}
            </span>
            <span>Page 1 of 1 · {lease.addenda.length} addenda</span>
          </div>
        </article>

        <aside className="pb-rail">
          <Section title="Status">
            <div className="pb-rail-status">
              <Pill tone={LEASE_TONE[lease.status]} dot>{statusLabel}</Pill>
              <span className="faint">
                {pending ? `Sent ${lease.sent!.date === TODAY ? fmtMin(lease.sent!.min) : shortDate(lease.sent!.date)}${REMINDED.get(lease.key) ? ` · ${REMINDED.get(lease.key)} reminder${REMINDED.get(lease.key)! > 1 ? "s" : ""}` : ""}` : lease.signed ? `Signed ${longDate(lease.signed.date)}` : ""}
              </span>
            </div>
            <KV
              items={[
                ["Unit", <span key="u" className="mono">{lease.unitId}</span>],
                ["Term", "Month to month"],
                ["Start", longDate(lease.start)],
                ...(lease.end ? ([["End", longDate(lease.end)]] as [string, string][]) : []),
                ["Rent", <span key="r" className="tnum">{money(lease.rent, true)}/mo</span>],
                ["Due", `${ordinal(lease.billingDay)} of the month`],
                ["Late fee", `$${LATE_FEE} after 5 days`],
                ["Protection", lease.protection ? `${lease.plan} · ${money(lease.protection)}` : "Declined"],
                ["Autopay", lease.autopay ? lease.card ?? "At signing" : "Off"],
                ["Signed via", lease.signed?.via ?? "Link by SMS and email"],
              ]}
            />
          </Section>

          <AgentBox title="In plain language">
            {summary.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
          </AgentBox>

          <Section title="Addenda" action={<span className="pb-legend">{lease.addenda.length}</span>}>
            <ul className="pb-list">
              {lease.addenda.map(a => (
                <li key={a.id}>
                  <FileText size={15} className="faint" />
                  <div>
                    <b>{a.title}</b>
                    <small>{a.note ? `${a.note} · ` : ""}{shortDate(a.date)}</small>
                  </div>
                  <Pill tone={a.status === "Draft" ? "warn" : a.status === "Signed" || a.status === "Acknowledged" ? "ok" : "neutral"}>{a.status}</Pill>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Audit trail" action={<span className="pb-legend"><ShieldCheck size={12} /> tamper-evident</span>}>
            <ol className="pb-audit">
              {lease.audit
                .slice()
                .reverse()
                .map((e, i) => (
                  <li key={i}>
                    <span className="pb-audit-dot" />
                    <div>
                      <b>{e.text}</b>
                      <small>
                        {e.who}
                        {e.meta ? ` · ${e.meta}` : ""}
                      </small>
                    </div>
                    <span className="mono faint">
                      {shortDate(e.date)}
                      {e.date.slice(0, 4) !== "2026" ? ` ’${e.date.slice(2, 4)}` : ""} {fmtMin(e.min)}
                    </span>
                  </li>
                ))}
            </ol>
          </Section>

          <Section title="Actions">
            <div className="pb-rail-acts">
              {pending ? (
                <>
                  <Button icon={<BellRing />} onClick={() => (remindSigner(lease), toast({ title: "Reminder sent", body: `${lease.name} · SMS and email`, tone: "ok" }))}>Resend signing link</Button>
                  <Button icon={<Phone />} onClick={() => startOutboundCall({ name: lease.name, phone: lease.phone, purpose: `help ${lease.first} sign the lease for ${lease.unitId}` })}>Call {lease.first}</Button>
                  <Button icon={<Sparkles />} onClick={() => askAgent(`Finish ${lease.name}'s move-in for ${lease.unitId}`)}>Finish with Zonera</Button>
                </>
              ) : lease.status === "ended" ? (
                <Button icon={<ArrowUpRight />} onClick={() => go("ops/units")}>See unit {lease.unitId}</Button>
              ) : (
                <>
                  <Button icon={<FilePlus2 />} onClick={() => askAgent(`Add an addendum to ${lease.name}'s lease for ${lease.unitId}`)}>Add addendum</Button>
                  <Button icon={<Check />} onClick={() => askAgent(`Run a rate review for ${lease.name} (${lease.unitId})`)}>Review rent</Button>
                  <Button icon={<CalendarX />} onClick={acts.moveOut} disabled={!t}>{lease.status === "ending" ? "Change move-out" : "Schedule move-out"}</Button>
                </>
              )}
            </div>
          </Section>
        </aside>
      </div>
      {acts.el}
    </div>
  );
}
