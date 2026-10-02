import React, { useEffect } from "react";
import { X, Check, Info, AlertTriangle, PhoneCall, CircleAlert } from "lucide-react";
import { toasts, dismissToast, go, useDemo, type Toast } from "../state/store";
import { STATUS_COLORS } from "../three/FacilityScene";
import type { UnitStatus } from "../data/facility";

// Shared primitives. Areas compose these; they never restyle them.

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "accent" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  iconOnly?: boolean;
};

export function Button({ variant = "default", size = "md", icon, iconOnly, className = "", children, ...rest }: BtnProps) {
  const cls = ["z-btn", variant !== "default" && `z-btn--${variant}`, size !== "md" && `z-btn--${size}`, iconOnly && "z-iconbtn", className].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} {...rest}>
      {icon}
      {!iconOnly && children}
    </button>
  );
}

export type Tone = "neutral" | "ok" | "warn" | "bad" | "info" | "violet" | "accent" | "lake";

export function Pill({ tone = "neutral", dot, live, children, className = "" }: { tone?: Tone; dot?: boolean; live?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={`z-pill ${tone !== "neutral" ? "z-pill--" + tone : ""} ${className}`}>
      {dot && <span className={`z-dot ${live ? "z-dot--live" : ""}`} />}
      {children}
    </span>
  );
}

export const STATUS_LABEL: Record<UnitStatus, string> = {
  occupied: "Occupied",
  vacant: "Available",
  reserved: "Reserved",
  delinquent: "Past due",
  overlocked: "Overlocked",
  maintenance: "Maintenance",
};
const STATUS_TONE: Record<UnitStatus, Tone> = { occupied: "neutral", vacant: "ok", reserved: "info", delinquent: "warn", overlocked: "bad", maintenance: "violet" };

export function UnitStatusPill({ status }: { status: UnitStatus }) {
  return (
    <Pill tone={STATUS_TONE[status]} dot>
      {STATUS_LABEL[status]}
    </Pill>
  );
}

export function StatusSwatch({ status, label }: { status: UnitStatus; label?: string }) {
  return (
    <span className="z-status">
      <i style={{ background: STATUS_COLORS[status] }} />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

const HUES = [210, 160, 25, 280, 340, 190, 45, 120];
export function Avatar({ name, size, className = "" }: { name: string; size?: "sm" | "lg"; className?: string }) {
  const initials = name.split(/\s+/).map(s => s[0]).slice(0, 2).join("").toUpperCase();
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = HUES[h % HUES.length];
  return (
    <span className={`z-avatar ${size ? "z-avatar--" + size : ""} ${className}`} style={{ background: `hsl(${hue} 45% 88%)`, color: `hsl(${hue} 40% 26%)` }} aria-hidden>
      {initials}
    </span>
  );
}

export function Card({ title, action, children, className = "", bodyClass = "" }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`z-card ${className}`}>
      {(title || action) && (
        <div className="z-card-h">
          {typeof title === "string" ? <h3>{title}</h3> : title}
          {action}
        </div>
      )}
      <div className={`z-card-b ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function Seg<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div className="z-seg" role="group" aria-label={ariaLabel}>
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Drawer({ open, onClose, children, width }: { open: boolean; onClose: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="z-scrim" onClick={onClose} />
      <aside className="z-drawer" style={width ? { width: `min(${width}px, 100vw)` } : undefined} role="dialog" aria-modal="true">
        {children}
      </aside>
    </>
  );
}

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="z-scrim" onClick={onClose} />
      <div className="z-modal" role="dialog" aria-modal="true">
        {children}
      </div>
    </>
  );
}

/** Small area sparkline. values are plotted to fill the box. */
export function Sparkline({ values, width = 120, height = 32, color = "var(--lake)", fill = true, className = "" }: { values: number[]; width?: number; height?: number; color?: string; fill?: boolean; className?: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 3;
  const pts = values.map((v, i) => [pad + (i * (width - pad * 2)) / Math.max(1, values.length - 1), height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  const id = React.useId().replace(/:/g, "");
  return (
    <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {fill && (
        <>
          <defs>
            <linearGradient id={"sg" + id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.22" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d} L ${last[0]} ${height} L ${pts[0][0]} ${height} Z`} fill={`url(#sg${id})`} />
        </>
      )}
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  );
}

export function Wordmark({ size = 28, className = "", color }: { size?: number; className?: string; color?: string }) {
  return (
    <span className={`z-wordmark ${className}`} style={{ fontSize: size, color }}>
      zonera
    </span>
  );
}

/** The mark: a Z monogram cut from a rounded square. Monochrome. */
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect x="0" y="0" width="32" height="32" rx="8" fill="var(--ink)" />
      <path d="M9 9.5h14v3.2L14.6 19.3H23v3.2H9v-3.2l8.4-6.6H9z" fill="var(--paper)" />
    </svg>
  );
}

const TOAST_ICON: Record<NonNullable<Toast["tone"]>, React.ReactNode> = {
  ok: <Check color="var(--ok)" />,
  info: <Info color="var(--info)" />,
  warn: <AlertTriangle color="var(--warn)" />,
  bad: <CircleAlert color="var(--bad)" />,
  call: <PhoneCall color="var(--accent)" />,
};

export function Toasts() {
  useDemo();
  return (
    <div className="z-toasts" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="z-toast">
          <span className="z-toast-ic">{TOAST_ICON[t.tone ?? "info"]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{t.title}</b>
            {t.body && <p>{t.body}</p>}
            {t.action && (
              <button
                className="z-btn z-btn--sm"
                style={{ marginTop: 8 }}
                onClick={() => {
                  go(t.action!.route);
                  dismissToast(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
          <button className="z-btn z-btn--ghost z-btn--sm z-iconbtn" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
            <X />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Type text into a setter one character at a time (movie mode, agent replies). */
export async function typeInto(text: string, set: (s: string) => void, cps = 38) {
  for (let i = 1; i <= text.length; i++) {
    set(text.slice(0, i));
    await new Promise(r => setTimeout(r, 1000 / cps + (Math.random() * 18 - 6)));
  }
}
