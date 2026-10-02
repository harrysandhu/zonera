import React, { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import "../../../styles/ops-pages-a.css";

// Small pieces shared by the Facility, Units, Gate, Maintenance, Reports and Settings pages.

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className="pa-switch" onClick={() => onChange(!on)}>
      <i />
    </button>
  );
}

export function SearchBox({ value, onChange, placeholder, className = "", onKeyDown, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void; autoFocus?: boolean }) {
  return (
    <label className={`pa-search ${className}`}>
      <Search size={14} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} onKeyDown={onKeyDown} autoFocus={autoFocus} />
      {value && (
        <button type="button" aria-label="Clear" onClick={() => onChange("")}>
          <X size={13} />
        </button>
      )}
    </label>
  );
}

export function Select<T extends string>({ value, onChange, options, className = "", ariaLabel }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string; ariaLabel?: string }) {
  return (
    <select className={`z-input pa-select ${className}`} value={value} aria-label={ariaLabel} onChange={e => onChange(e.target.value as T)}>
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`z-field pa-field ${className}`}>
      <label>{label}</label>
      {children}
      {hint && <span className="pa-hint">{hint}</span>}
    </div>
  );
}

export function DrawerHead({ title, sub, onClose, extra }: { title: React.ReactNode; sub?: React.ReactNode; onClose: () => void; extra?: React.ReactNode }) {
  return (
    <div className="pa-dh">
      <div className="pa-dh-t">
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {extra}
      <button className="z-btn z-btn--ghost z-btn--sm z-iconbtn" aria-label="Close" onClick={onClose}>
        <X />
      </button>
    </div>
  );
}

/** Chip-style multi toggle. */
export function MultiChips<T extends string>({ value, options, onChange }: { value: T[]; options: { value: T; label: string }[]; onChange: (v: T[]) => void }) {
  return (
    <div className="ok-chips" role="group">
      {options.map(o => {
        const on = value.includes(o.value);
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter(v => v !== o.value) : [...value, o.value])}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Keep a value "fresh" for a short time after it changes (row flash on insert). */
export function useFresh(key: string | number, ms = 1600) {
  const [fresh, setFresh] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setFresh(true);
    const t = setTimeout(() => setFresh(false), ms);
    return () => clearTimeout(t);
  }, [key, ms]);
  return fresh;
}

export function Legend({ items }: { items: { label: string; swatch: string }[] }) {
  return (
    <span className="pa-legend">
      {items.map(i => (
        <span key={i.label}>
          <i style={{ background: i.swatch }} />
          {i.label}
        </span>
      ))}
    </span>
  );
}
