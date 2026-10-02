import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Map as MapIcon, Sparkles, MessageSquare, X } from "lucide-react";
import { Page, PageHeader, Section, Stat, StatRow, Toolbar, Chips, Empty } from "../kit";
import { Avatar, Button, UnitStatusPill, STATUS_LABEL } from "../../ui";
import { askAgent, fmt, go, toast, useDemo } from "../../state/store";
import { UNITS, UNIT_BY_ID, occupancy, type Unit, type UnitSize, type UnitStatus } from "../../data/facility";
import { tenantForUnit } from "../../data/tenants";
import { SearchBox, Select } from "./a/kit";
import { UnitDrawer } from "./a/UnitDetail";
import { KIND_LABEL, SIZES, STATUS_ORDER, buildingName, lastActivity, sizeLabel, sqft } from "./a/units";

type SortKey = "id" | "building" | "size" | "status" | "tenant" | "rent" | "sqft" | "activity";
const PER = 50;
const SIZE_RANK = Object.fromEntries(SIZES.map((s, i) => [s, i]));
const STATUS_RANK = Object.fromEntries(STATUS_ORDER.map((s, i) => [s, i]));

export default function UnitsPage({ id }: { id?: string }) {
  useDemo();
  const [status, setStatus] = useState<"all" | UnitStatus>("all");
  const [size, setSize] = useState<"all" | UnitSize>("all");
  const [kind, setKind] = useState<"all" | Unit["kind"]>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "id", dir: 1 });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(id && UNIT_BY_ID.has(id) ? id : null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id && UNIT_BY_ID.has(id)) setOpen(id);
  }, [id]);
  useEffect(() => setPage(0), [status, size, kind, q]);

  const occ = occupancy();
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = UNITS.filter(u => {
      if (status !== "all" && u.status !== status) return false;
      if (size !== "all" && u.size !== size) return false;
      if (kind !== "all" && u.kind !== kind) return false;
      if (s) {
        const t = tenantForUnit(u);
        if (!u.id.toLowerCase().includes(s) && !(t && t.name.toLowerCase().includes(s))) return false;
      }
      return true;
    }).map(u => ({ u, t: tenantForUnit(u), act: lastActivity(u) }));
    const val = (r: (typeof list)[number]): number | string => {
      switch (sort.k) {
        case "id":
          return r.u.building + String(r.u.id.split("-")[1]).padStart(4, "0");
        case "building":
          return r.u.building + r.u.floor;
        case "size":
          return SIZE_RANK[r.u.size];
        case "status":
          return STATUS_RANK[r.u.status];
        case "tenant":
          return r.t ? r.t.last + r.t.first : "~";
        case "rent":
          return r.t ? r.t.rent / r.u.rate : 9;
        case "sqft":
          return sqft(r.u);
        case "activity":
          return r.act.ago;
      }
    };
    return list.sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, size, kind, q, sort, UNITS.map(u => u.status).join()]);

  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const view = rows.slice(page * PER, page * PER + PER);
  const counts = STATUS_ORDER.map(s => ({ s, n: UNITS.filter(u => u.status === s).length }));
  const occupiedUnits = UNITS.filter(u => u.tenantId);
  const inPlace = occupiedUnits.reduce((s, u) => s + (tenantForUnit(u)?.rent ?? 0), 0);
  const street = occupiedUnits.reduce((s, u) => s + u.rate, 0);
  const vacantSqft = UNITS.filter(u => u.status === "vacant").reduce((s, u) => s + sqft(u), 0);
  const potential = UNITS.filter(u => u.status === "vacant").reduce((s, u) => s + u.rate, 0);

  const th = (k: SortKey, label: string, cls = "") => (
    <th className={cls}>
      <button className={`pa-th ${sort.k === k ? "on" : ""}`} onClick={() => setSort(s => ({ k, dir: s.k === k ? ((-s.dir) as 1 | -1) : 1 }))}>
        {label}
        {sort.k === k && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </button>
    </th>
  );

  const toggle = (uid: string) =>
    setPicked(p => {
      const n = new Set(p);
      n.has(uid) ? n.delete(uid) : n.add(uid);
      return n;
    });
  const allOnPage = view.length > 0 && view.every(r => picked.has(r.u.id));

  return (
    <Page className="pa-units">
      <PageHeader
        title="Units"
        sub={`${UNITS.length} units across 5 buildings · ${occ.vacant} available · ${occ.reserved} reserved`}
        ask="Which units have been empty the longest, and what should I charge?"
        actions={
          <>
            <Button icon={<MapIcon />} onClick={() => go("ops/facility")}>
              Digital twin
            </Button>
            <Button icon={<Download />} onClick={() => toast({ title: "Rent roll exported", body: `units-alder-lake-2026-10-02.csv · ${UNITS.length} rows`, tone: "ok" })}>
              Export
            </Button>
          </>
        }
      />

      <StatRow>
        <Stat label="Occupancy · units" value={fmt.pct(occ.byUnit)} delta={`${occ.occupied} of ${UNITS.length - counts.find(c => c.s === "maintenance")!.n}`} tone="neutral" sub="rentable" />
        <Stat label="Occupancy · sq ft" value={fmt.pct(occ.bySqft)} delta={`${vacantSqft.toLocaleString()} sq ft`} tone="neutral" sub="free" />
        <Stat label="Available" value={String(occ.vacant)} delta={fmt.money(potential)} tone="ok" sub="/mo at street" />
        <Stat label="In-place vs street" value={fmt.pct(inPlace / street - 1)} delta={`−${fmt.money(street - inPlace)}/mo`} tone="warn" sub="below street" />
        <Stat label="Past due or overlocked" value={String(counts.filter(c => c.s === "delinquent" || c.s === "overlocked").reduce((s, c) => s + c.n, 0))} delta={`${counts.find(c => c.s === "overlocked")!.n} overlocked`} tone="bad" sub="units" />
      </StatRow>

      <Toolbar>
        <SearchBox className="pa-units-q" value={q} onChange={setQ} placeholder="Search unit or tenant" />
        <Chips
          value={status}
          onChange={setStatus}
          options={[{ value: "all" as const, label: "All", count: UNITS.length }, ...counts.map(c => ({ value: c.s, label: STATUS_LABEL[c.s], count: c.n }))]}
        />
        <span className="pa-tb-sp" />
        <Select ariaLabel="Size" value={size} onChange={setSize} options={[{ value: "all", label: "All sizes" }, ...SIZES.map(s => ({ value: s, label: sizeLabel(s) }))]} />
        <Select ariaLabel="Type" value={kind} onChange={setKind} options={[{ value: "all", label: "All types" }, { value: "drive-up", label: "Drive-up" }, { value: "climate", label: "Climate" }, { value: "parking", label: "Parking" }]} />
      </Toolbar>

      <Section flush className="pa-units-tbl">
        {view.length ? (
          <div className="z-table-wrap">
            <table className="z-table pa-table">
              <thead>
                <tr>
                  <th className="pa-cb">
                    <input
                      type="checkbox"
                      aria-label="Select page"
                      checked={allOnPage}
                      onChange={() =>
                        setPicked(p => {
                          const n = new Set(p);
                          view.forEach(r => (allOnPage ? n.delete(r.u.id) : n.add(r.u.id)));
                          return n;
                        })
                      }
                    />
                  </th>
                  {th("id", "Unit")}
                  {th("building", "Building")}
                  {th("size", "Size")}
                  <th>Type</th>
                  {th("status", "Status")}
                  {th("tenant", "Tenant")}
                  {th("rent", "In-place / street", "num")}
                  {th("sqft", "Sq ft", "num")}
                  {th("activity", "Last activity")}
                </tr>
              </thead>
              <tbody>
                {view.map(({ u, t, act }) => {
                  const gap = t ? t.rent / u.rate - 1 : 0;
                  return (
                    <tr key={u.id} className={`pa-row ${open === u.id ? "on" : ""} ${picked.has(u.id) ? "picked" : ""}`} onClick={() => setOpen(u.id)}>
                      <td className="pa-cb" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Select ${u.id}`} checked={picked.has(u.id)} onChange={() => toggle(u.id)} />
                      </td>
                      <td>
                        <span className="mono pa-id">{u.id}</span>
                      </td>
                      <td className="muted">
                        {buildingName(u.building)}
                        {u.kind === "climate" && <span className="faint"> · F{u.floor}</span>}
                      </td>
                      <td>
                        <span className="mono">{sizeLabel(u.size)}</span>
                      </td>
                      <td className="muted">{KIND_LABEL[u.kind]}</td>
                      <td>
                        <UnitStatusPill status={u.status} />
                      </td>
                      <td>
                        {t ? (
                          <button
                            className="pa-tenant"
                            onClick={e => {
                              e.stopPropagation();
                              go("ops/tenants/" + t.id);
                            }}
                          >
                            <Avatar name={t.name} size="sm" />
                            <span>{t.name}</span>
                            {t.balance > 0 && <span className="pa-due mono">{fmt.money(t.balance)}</span>}
                          </button>
                        ) : (
                          <span className="faint">—</span>
                        )}
                      </td>
                      <td className="num">
                        {t ? (
                          <span className="pa-rent">
                            <b className="tnum">{fmt.money(t.rent)}</b>
                            <span className="faint tnum">/ {fmt.money(u.rate)}</span>
                            <em className={`mono ${gap < -0.12 ? "warn" : ""}`}>{gap < -0.005 ? (gap * 100).toFixed(0) + "%" : "—"}</em>
                          </span>
                        ) : (
                          <span className="pa-rent">
                            <span className="faint tnum">{fmt.money(u.rate)}</span>
                            <em className="mono" />
                          </span>
                        )}
                      </td>
                      <td className="num mono pa-sq">{sqft(u)}</td>
                      <td>
                        <span className="pa-act">
                          {act.text}
                          <span className="mono faint"> · {act.when}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No units match"
            body="Try a different status, size or search."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setStatus("all");
                  setSize("all");
                  setKind("all");
                  setQ("");
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}
        <div className="pa-pager">
          <span className="mono faint">
            {rows.length ? `${page * PER + 1}–${Math.min(rows.length, page * PER + PER)} of ${rows.length}` : "0 units"}
          </span>
          <div>
            <Button size="sm" iconOnly icon={<ChevronLeft />} aria-label="Previous page" disabled={page === 0} onClick={() => setPage(p => p - 1)} />
            <Button size="sm" iconOnly icon={<ChevronRight />} aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} />
          </div>
        </div>
      </Section>

      {picked.size > 0 && (
        <div className="pa-bulk">
          <span className="mono">{picked.size} selected</span>
          <Button size="sm" variant="ghost" icon={<MessageSquare />} onClick={() => askAgent(`Text the tenants in ${[...picked].slice(0, 6).join(", ")}${picked.size > 6 ? ` and ${picked.size - 6} more` : ""}`)}>
            Message tenants
          </Button>
          <Button size="sm" variant="ghost" icon={<Sparkles />} onClick={() => askAgent(`Review rates for ${[...picked].slice(0, 6).join(", ")}${picked.size > 6 ? ` and ${picked.size - 6} more units` : ""}`)}>
            Rate review
          </Button>
          <Button size="sm" variant="ghost" icon={<Download />} onClick={() => toast({ title: `Exported ${picked.size} units`, body: "units-selection.csv", tone: "ok" })}>
            Export
          </Button>
          <Button size="sm" variant="ghost" iconOnly icon={<X />} aria-label="Clear selection" onClick={() => setPicked(new Set())} />
        </div>
      )}

      <UnitDrawer unitId={open} onClose={() => setOpen(null)} />
    </Page>
  );
}
