import React, { useEffect, useRef, useState } from "react";
import { Search, X, Sparkles, ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import { Avatar, Pill, type Tone } from "../../../ui";
import type { Tenant } from "../../../data/tenants";
import { UNIT_BY_ID, type UnitStatus } from "../../../data/facility";
import { STATUS_COLORS } from "../../../three/FacilityScene";
import "../../../styles/ops-pages-b.css";

// Small pieces shared by the part-2 operator pages (prefix pb-).

export const money = (n: number, cents = false) =>
  (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

export function tenure(moveIn: string) {
  const [y, m, d] = moveIn.split("-").map(Number);
  let months = (2026 - y) * 12 + (10 - m) - (d > 2 ? 1 : 0);
  months = Math.max(0, months);
  const yy = Math.floor(months / 12);
  const mm = months % 12;
  if (!yy) return `${mm || "<1"}m`;
  return mm ? `${yy}y ${mm}m` : `${yy}y`;
}

export const sizeText = (s: string) => s.replace("x", "×");

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number | string }[] }) {
  return (
    <div className="pb-tabs" role="tablist">
      {items.map(i => (
        <button key={i.value} role="tab" aria-selected={i.value === value} onClick={() => onChange(i.value)}>
          {i.label}
          {i.count !== undefined && <em>{i.count}</em>}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, width }: { value: string; onChange: (v: string) => void; placeholder: string; width?: number }) {
  return (
    <label className="pb-search" style={width ? { width } : undefined}>
      <Search size={14} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      {value && (
        <button type="button" aria-label="Clear" onClick={() => onChange("")}>
          <X size={13} />
        </button>
      )}
    </label>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`pb-toggle ${on ? "on" : ""}`} onClick={e => (e.stopPropagation(), onChange(!on))}>
      <i />
    </button>
  );
}

export function Menu({ items, label = "More", trigger }: { items: ({ label: string; icon?: React.ReactNode; danger?: boolean; onClick: () => void; hint?: string } | null)[]; label?: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", off);
    window.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", off);
      window.removeEventListener("keydown", k);
    };
  }, [open]);
  return (
    <div className="pb-menu" ref={ref}>
      <button type="button" className="z-btn z-iconbtn" aria-label={label} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {trigger ?? <MoreHorizontal />}
      </button>
      {open && (
        <div className="pb-menu-pop" role="menu">
          {items.map((it, i) =>
            it ? (
              <button
                key={i}
                role="menuitem"
                className={it.danger ? "danger" : ""}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
              >
                {it.icon}
                <span>{it.label}</span>
                {it.hint && <small>{it.hint}</small>}
              </button>
            ) : (
              <hr key={i} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Header + body + footer layout inside the shared <Modal>. */
export function ModalShell({ title, sub, onClose, children, foot, icon }: { title: React.ReactNode; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="pb-mod">
      <div className="pb-mod-h">
        {icon && <span className="pb-mod-ic">{icon}</span>}
        <div>
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
        </div>
        <button className="z-btn z-btn--ghost z-btn--sm z-iconbtn" aria-label="Close" onClick={onClose}>
          <X />
        </button>
      </div>
      <div className="pb-mod-b">{children}</div>
      {foot && <div className="pb-mod-f">{foot}</div>}
    </div>
  );
}

export function TenantCell({ t, sub }: { t: Pick<Tenant, "name"> & Partial<Tenant>; sub?: React.ReactNode }) {
  return (
    <span className="pb-who">
      <Avatar name={t.name} size="sm" />
      <span>
        <b>{t.name}</b>
        {sub && <small>{sub}</small>}
      </span>
    </span>
  );
}

export function UnitTag({ id, status }: { id: string; status?: UnitStatus }) {
  const st = status ?? UNIT_BY_ID.get(id)?.status;
  return (
    <span className="pb-unit mono">
      {st && <i style={{ background: STATUS_COLORS[st] }} />}
      {id}
    </span>
  );
}

export function LatePill({ days }: { days: number }) {
  if (!days) return <span className="faint">—</span>;
  const tone: Tone = days > 30 ? "bad" : days > 14 ? "warn" : "warn";
  return <Pill tone={tone}>{days}d late</Pill>;
}

export function AgentBox({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="pb-agent">
      <div className="pb-agent-h">
        <span className="pb-agent-ic">
          <Sparkles size={13} />
        </span>
        <b>{title}</b>
        {action}
      </div>
      <div className="pb-agent-b">{children}</div>
    </div>
  );
}

export function SortTh<K extends string>({ k, sort, setSort, children, num }: { k: K; sort: { k: K; dir: 1 | -1 }; setSort: (s: { k: K; dir: 1 | -1 }) => void; children: React.ReactNode; num?: boolean }) {
  const on = sort.k === k;
  return (
    <th className={`${num ? "num" : ""} pb-sort ${on ? "on" : ""}`} aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button onClick={() => setSort({ k, dir: on ? (sort.dir === 1 ? -1 : 1) : num ? -1 : 1 })}>
        {children}
        {on && (sort.dir === 1 ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </button>
    </th>
  );
}

export const PROT_SHORT: Record<number, string> = { 0: "None", 2000: "$2k", 5000: "$5k", 10000: "$10k" };

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="pb-field">
      <label>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}
