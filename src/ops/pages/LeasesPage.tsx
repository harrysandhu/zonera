import React, { useMemo, useState } from "react";
import { FileSignature, BellRing, Phone, ChevronRight, Download, Clock } from "lucide-react";
import { Page, PageHeader, Section, Stat, StatRow, Toolbar, Chips, Empty } from "../kit";
import { Button, Pill } from "../../ui";
import { go, toast, useDemo, askAgent } from "../../state/store";
import { TENANTS } from "../../data/tenants";
import { allLeases, leaseByKey, remindSigner, REMINDED, PENDING, sizeLabel, type Lease } from "../../data/leases";
import { fmtMin, shortDate, longDate, TODAY, daysBetween } from "../../data/ledger";
import { startOutboundCall } from "../../calls/api";
import { LeaseView, LEASE_LABEL, LEASE_TONE } from "./b/LeaseView";
import { money, SearchBox, TenantCell, UnitTag } from "./b/ui";

type Filter = "all" | Lease["status"];

export default function LeasesPage({ id }: { id?: string }) {
  useDemo();
  if (id) {
    const l = leaseByKey(id);
    if (l) return <LeaseView key={l.key} lease={l} />;
    return (
      <Page>
        <Empty title="Lease not found" body={`Nothing matches ${id}.`} action={<Button onClick={() => go("ops/leases")}>All leases</Button>} />
      </Page>
    );
  }
  return <LeasesList />;
}

function LeasesList() {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);
  const leases = allLeases();
  const by = (s: Lease["status"]) => leases.filter(l => l.status === s);
  const pending = by("pending");
  const signedSep = TENANTS.filter(t => t.moveIn >= "2026-09-01").length;
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const order: Record<Lease["status"], number> = { pending: 0, ending: 1, active: 2, ended: 3 };
    return leases
      .filter(l => filter === "all" || l.status === filter)
      .filter(l => !s || l.name.toLowerCase().includes(s) || l.unitId.toLowerCase().includes(s) || l.number.toLowerCase().includes(s))
      .sort((a, b) => order[a.status] - order[b.status] || (a.start < b.start ? 1 : -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, q, leases.length, leases.map(l => l.status).join("")]);

  return (
    <Page>
      <PageHeader
        title="Leases"
        sub={`${by("active").length + by("ending").length} active agreements · ${pending.length} out for signature`}
        ask="Remind everyone who hasn't signed their lease"
        actions={
          <>
            <Button icon={<Download />} onClick={() => toast({ title: "Export ready", body: `${leases.length} agreements · CSV with signature certificates`, tone: "info" })}>Export</Button>
            <Button variant="primary" icon={<FileSignature />} onClick={() => askAgent("Move in a walk-in customer")}>New lease</Button>
          </>
        }
      />

      <StatRow>
        <Stat label="Active" value={by("active").length + by("ending").length} delta={`+${signedSep}`} tone="ok" sub="signed since Sep 1" />
        <Stat label="Pending signature" value={pending.length} delta={pending[0] ? `oldest ${daysBetween(pending.slice().sort((a, b) => (a.sent!.date < b.sent!.date ? -1 : 1))[0].sent!.date, TODAY)}d` : "none"} tone={pending.length ? "warn" : "ok"} sub="waiting" />
        <Stat label="Ending" value={by("ending").length} delta="Oct 31" tone="neutral" sub="next move-out" />
        <Stat label="Signed online" value="64%" delta="+9 pts" tone="ok" sub="vs last year" />
        <Stat label="Median time to sign" value="3m 40s" delta="−52s" tone="ok" sub="vs Q2" />
      </StatRow>

      {pending.length > 0 && (
        <section className="pb-callout">
          <div className="pb-callout-h">
            <span className="pb-callout-ic"><Clock size={14} /></span>
            <div>
              <b>{pending.length} lease{pending.length > 1 ? "s" : ""} waiting on a signature</b>
              <span>Units stay held until signed. Reminders go by SMS and email.</span>
            </div>
          </div>
          <ul>
            {pending.map(l => (
              <li key={l.key}>
                <TenantCell t={{ name: l.name }} sub={<><span className="mono">{l.unitId}</span> · {sizeLabel(l.unitId)} · {money(l.rent)}/mo</>} />
                <span className="pb-callout-m">
                  Sent {l.sent!.date === TODAY ? fmtMin(l.sent!.min) : shortDate(l.sent!.date)}
                  {l.viewed ? ` · opened ${shortDate(l.viewed.date)}` : " · not opened"}
                  {REMINDED.get(l.key) ? ` · reminded ${REMINDED.get(l.key)}×` : ""}
                </span>
                <div className="pb-row">
                  <Button size="sm" icon={<BellRing />} onClick={() => (remindSigner(l), toast({ title: "Reminder sent", body: `${l.name} · ${l.phone}`, tone: "ok" }))}>Remind</Button>
                  <Button size="sm" icon={<Phone />} onClick={() => startOutboundCall({ name: l.name, phone: l.phone, purpose: `help ${l.first} sign the lease for ${l.unitId}` })}>Call</Button>
                  <Button size="sm" onClick={() => go("ops/leases/" + l.key)}>Open</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search name, unit, agreement no." width={280} />
        <Chips<Filter>
          value={filter}
          onChange={v => (setFilter(v), setLimit(50))}
          options={[
            { value: "all", label: "All", count: leases.length },
            { value: "active", label: "Active", count: by("active").length },
            { value: "pending", label: "Pending signature", count: pending.length },
            { value: "ending", label: "Ending", count: by("ending").length },
            { value: "ended", label: "Ended", count: by("ended").length },
          ]}
        />
      </Toolbar>

      <Section flush>
        <div className="z-table-wrap">
          <table className="z-table pb-tt">
            <thead>
              <tr>
                <th>Agreement</th>
                <th>Occupant</th>
                <th>Unit</th>
                <th>Start</th>
                <th className="num">Rent</th>
                <th>Status</th>
                <th>Signed</th>
                <th className="num">Addenda</th>
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map(l => (
                <tr key={l.key} className="pb-row-link" onClick={() => go("ops/leases/" + l.key)}>
                  <td className="mono pb-lno">{l.number}</td>
                  <td><TenantCell t={{ name: l.name }} sub={l.business ?? l.email} /></td>
                  <td>
                    <span className="pb-unitcell">
                      <UnitTag id={l.unitId} />
                      <small className="faint">{sizeLabel(l.unitId).split(" ")[0]}</small>
                    </span>
                  </td>
                  <td className="mono pb-ten">{shortDate(l.start)} ’{l.start.slice(2, 4)}</td>
                  <td className="num">{money(l.rent)}</td>
                  <td>
                    <Pill tone={LEASE_TONE[l.status]} dot>
                      {l.status === "ending" ? `Ending ${shortDate(l.end!)}` : l.status === "ended" ? `Ended ${shortDate(l.end!)}` : LEASE_LABEL[l.status]}
                    </Pill>
                  </td>
                  <td className="faint pb-lc">{l.signed ? l.signed.via : l.sent ? `Sent ${l.sent.date === TODAY ? fmtMin(l.sent.min) : shortDate(l.sent.date)}` : "—"}</td>
                  <td className="num mono pb-ten">{l.addenda.length}</td>
                  <td className="pb-chev"><ChevronRight size={15} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > limit && (
          <button className="pb-more" onClick={() => setLimit(x => x + 100)}>
            Show {Math.min(100, rows.length - limit)} more of {rows.length}
          </button>
        )}
      </Section>
      <p className="pb-foot-note">Agreements follow the California Self-Service Storage Facility Act (Bus. &amp; Prof. Code §§21700–21716). Template v4.2, reviewed {longDate("2026-06-12")}.</p>
    </Page>
  );
}

export { PENDING };
