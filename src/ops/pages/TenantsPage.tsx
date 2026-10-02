import React, { useMemo, useState } from "react";
import { Download, UserPlus, ChevronRight } from "lucide-react";
import { Page, PageHeader, Section, Stat, StatRow, Toolbar, Chips, Empty } from "../kit";
import { Button, Pill } from "../../ui";
import { askAgent, go, toast, useDemo } from "../../state/store";
import { TENANTS, TENANT_BY_ID, type Tenant } from "../../data/tenants";
import { UNIT_BY_ID } from "../../data/facility";
import { MONTHLY } from "../../data/tenants";
import { TenantProfile } from "./b/Profile";
import { lastContactLabel } from "./b/insight";
import { money, tenure, SearchBox, TenantCell, UnitTag, LatePill, SortTh, PROT_SHORT, sizeText } from "./b/ui";
import { MOVE_OUTS } from "../../data/leases";

type Filter = "all" | "current" | "late" | "locked" | "noauto" | "business" | "moving";
type SortKey = "name" | "unit" | "rent" | "balance" | "late" | "tenure";

const locked = (t: Tenant) => t.unitIds.some(id => UNIT_BY_ID.get(id)?.status === "overlocked");

export default function TenantsPage({ id }: { id?: string }) {
  useDemo();
  if (id) {
    const t = TENANT_BY_ID.get(id);
    if (t) return <TenantProfile key={t.id} t={t} />;
    return (
      <Page>
        <Empty title="Tenant not found" body={`No tenant with id ${id}.`} action={<Button onClick={() => go("ops/tenants")}>All tenants</Button>} />
      </Page>
    );
  }
  return <TenantsList />;
}

function TenantsList() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "late", dir: -1 });
  const [limit, setLimit] = useState(60);

  const test: Record<Filter, (t: Tenant) => boolean> = {
    all: () => true,
    current: t => t.daysLate === 0,
    late: t => t.daysLate > 0,
    locked,
    noauto: t => !t.autopay,
    business: t => !!t.business,
    moving: t => MOVE_OUTS.has(t.id),
  };

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = TENANTS.filter(test[filter]).filter(
      t => !s || t.name.toLowerCase().includes(s) || t.unitIds.some(u => u.toLowerCase().includes(s)) || t.phone.replace(/\D/g, "").includes(s.replace(/\D/g, "") || "~") || t.email.includes(s) || (t.business ?? "").toLowerCase().includes(s),
    );
    const v = (t: Tenant): number | string =>
      sort.k === "name" ? t.last + t.first : sort.k === "unit" ? t.unitIds[0] : sort.k === "rent" ? t.rent : sort.k === "balance" ? t.balance : sort.k === "late" ? t.daysLate * 10000 + t.balance : -new Date(t.moveIn).getTime();
    return list.sort((a, b) => {
      const x = v(a), y = v(b);
      if (x === y) return a.last.localeCompare(b.last);
      return (x < y ? -1 : 1) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter, sort, TENANTS.length, TENANTS.reduce((s, t) => s + t.balance, 0)]);

  const late = TENANTS.filter(t => t.daysLate > 0);
  const rentRoll = TENANTS.reduce((s, t) => s + t.rent, 0);
  const auto = TENANTS.filter(t => t.autopay).length / TENANTS.length;
  const prot = TENANTS.filter(t => t.protection > 0).length / TENANTS.length;
  const avgTenure = TENANTS.reduce((s, t) => s + (2026 - +t.moveIn.slice(0, 4)) * 12 + (10 - +t.moveIn.slice(5, 7)), 0) / TENANTS.length;
  const units = TENANTS.reduce((s, t) => s + t.unitIds.length, 0);
  const sept = MONTHLY[MONTHLY.length - 1];

  return (
    <Page>
      <PageHeader
        title="Tenants"
        sub={`${TENANTS.length} tenants · ${units} units rented · ${money(rentRoll)}/mo rent roll`}
        ask="Who's more than 15 days late?"
        actions={
          <>
            <Button icon={<Download />} onClick={() => toast({ title: "Rent roll exported", body: `alder-lake-rent-roll-2026-10-02.csv · ${TENANTS.length} rows`, tone: "info" })}>
              Export
            </Button>
            <Button variant="primary" icon={<UserPlus />} onClick={() => askAgent("Move in a walk-in customer")}>
              New move-in
            </Button>
          </>
        }
      />

      <StatRow>
        <Stat label="Tenants" value={TENANTS.length} delta={`+${sept.moveIns - sept.moveOuts} net`} tone="ok" sub="in September" />
        <Stat label="Past due" value={money(late.reduce((s, t) => s + t.balance, 0))} delta={`${late.length} tenants`} tone="warn" sub={`${TENANTS.filter(locked).length} overlocked`} />
        <Stat label="On autopay" value={`${Math.round(auto * 100)}%`} delta={`${TENANTS.filter(t => !t.autopay).length} manual`} tone="neutral" sub="pay by hand" />
        <Stat label="Protection attach" value={`${Math.round(prot * 100)}%`} delta={money(TENANTS.reduce((s, t) => s + [0, 12, 19, 29][[0, 2000, 5000, 10000].indexOf(t.protection)], 0))} tone="ok" sub="/mo premiums" />
        <Stat label="Average tenure" value={`${(avgTenure / 12).toFixed(1)} yrs`} delta={`${Math.round(avgTenure)} mo`} tone="neutral" sub="median 19 mo" />
      </StatRow>

      <Toolbar>
        <SearchBox value={q} onChange={v => (setQ(v), setLimit(60))} placeholder="Search name, unit, phone, email" width={300} />
        <Chips<Filter>
          value={filter}
          onChange={v => (setFilter(v), setLimit(60))}
          options={[
            { value: "all", label: "All", count: TENANTS.length },
            { value: "current", label: "Current", count: TENANTS.filter(test.current).length },
            { value: "late", label: "Past due", count: late.length },
            { value: "locked", label: "Overlocked", count: TENANTS.filter(locked).length },
            { value: "noauto", label: "Autopay off", count: TENANTS.filter(test.noauto).length },
            { value: "business", label: "Business", count: TENANTS.filter(test.business).length },
            { value: "moving", label: "Moving out", count: TENANTS.filter(test.moving).length },
          ]}
        />
      </Toolbar>

      <Section flush>
        {rows.length === 0 ? (
          <Empty title="No tenants match" body="Try a unit id like A-122, a last name, or the last four digits of a phone number." />
        ) : (
          <div className="z-table-wrap">
            <table className="z-table pb-tt">
              <thead>
                <tr>
                  <SortTh k="name" sort={sort} setSort={setSort}>Tenant</SortTh>
                  <SortTh k="unit" sort={sort} setSort={setSort}>Unit</SortTh>
                  <SortTh k="rent" sort={sort} setSort={setSort} num>Rent</SortTh>
                  <SortTh k="balance" sort={sort} setSort={setSort} num>Balance</SortTh>
                  <SortTh k="late" sort={sort} setSort={setSort}>Status</SortTh>
                  <th>Autopay</th>
                  <th>Protection</th>
                  <SortTh k="tenure" sort={sort} setSort={setSort} num>Tenure</SortTh>
                  <th>Last contact</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map(t => {
                  const u = UNIT_BY_ID.get(t.unitIds[0]);
                  return (
                    <tr key={t.id} className="pb-row-link" onClick={() => go("ops/tenants/" + t.id)} tabIndex={0} onKeyDown={e => e.key === "Enter" && go("ops/tenants/" + t.id)}>
                      <td>
                        <TenantCell t={t} sub={t.business ?? t.email} />
                      </td>
                      <td>
                        <span className="pb-unitcell">
                          {t.unitIds.map(id => (
                            <UnitTag key={id} id={id} />
                          ))}
                          {u && <small className="faint">{sizeText(u.size)}</small>}
                        </span>
                      </td>
                      <td className="num">{money(t.rent)}</td>
                      <td className={`num ${t.balance > 0 ? "pb-owed" : "faint"}`}>{t.balance > 0 ? money(t.balance, true) : "$0.00"}</td>
                      <td>
                        {locked(t) ? (
                          <span className="pb-stt">
                            <Pill tone="bad" dot>Overlocked</Pill>
                            <span className="mono faint">{t.daysLate}d</span>
                          </span>
                        ) : t.daysLate ? (
                          <span className="pb-stt"><LatePill days={t.daysLate} /></span>
                        ) : MOVE_OUTS.has(t.id) ? (
                          <Pill tone="violet">Moving {MOVE_OUTS.get(t.id)!.date.slice(5).replace("-", "/")}</Pill>
                        ) : (
                          <span className="faint">Current</span>
                        )}
                      </td>
                      <td>{t.autopay ? <span className="pb-auto"><i />{t.card?.replace("Mastercard", "MC")}</span> : <span className="faint">Off</span>}</td>
                      <td className={t.protection ? "" : "faint"}>{PROT_SHORT[t.protection]}</td>
                      <td className="num mono pb-ten">{tenure(t.moveIn)}</td>
                      <td className="faint pb-lc">{lastContactLabel(t)}</td>
                      <td className="pb-chev">
                        <ChevronRight size={15} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > limit && (
          <button className="pb-more" onClick={() => setLimit(l => l + 100)}>
            Show {Math.min(100, rows.length - limit)} more of {rows.length}
          </button>
        )}
      </Section>
    </Page>
  );
}
