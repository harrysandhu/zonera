import React, { useState } from "react";
import { FileCog, X, Plus, Check, FileText, Sheet, Link2 } from "lucide-react";
import { Avatar, Button } from "../../../ui";
import { defineWidget, Frame, stateOf } from "../frame";
import "../../../styles/agent-reports.css";

// W8 · ReportBuilder: report type, period, compare to, sections, format,
// recipients and schedule, prefilled from the prompt. Every control is one
// click; nothing is a blank form.
// Movie mode: "type:<v>", "period:<v>", "compare:<v>", "section:<id>",
// "format:<v>", "rcpt:<id>" (toggle), "add:<id>", "schedule:<v>", "submit".

export interface Opt {
  value: string;
  label: string;
}
export interface ReportPerson {
  id: string;
  name: string;
  email: string;
  role?: string;
}
export type ReportFormat = "pdf" | "csv" | "link";
export type ReportCadence = "once" | "daily" | "weekly" | "monthly";

export interface ReportBuilderProps {
  title?: string;
  type: string;
  types: Opt[];
  period: string;
  periods: Opt[];
  compare: string;
  compares: Opt[];
  sections: { id: string; label: string; on: boolean; hint?: string }[];
  format: ReportFormat;
  recipients: ReportPerson[];
  pool?: ReportPerson[];
  schedule: ReportCadence;
  schedules?: { value: ReportCadence; label: string }[];
  /** Shown under the schedule control, e.g. "Mondays at 7:00 am". */
  when?: Partial<Record<ReportCadence, string>>;
  cta?: string;
  note?: string;
}

export interface ReportBuilderAnswer {
  type: string;
  period: string;
  compare: string;
  sections: string[];
  format: ReportFormat;
  recipients: ReportPerson[];
  schedule: ReportCadence;
}

const FORMAT: { value: ReportFormat; label: string; icon: React.ReactNode }[] = [
  { value: "pdf", label: "PDF", icon: <FileText /> },
  { value: "csv", label: "CSV", icon: <Sheet /> },
  { value: "link", label: "Link", icon: <Link2 /> },
];

function Pills({ value, options, onChange, disabled, auto }: { value: string; options: Opt[]; onChange: (v: string) => void; disabled: boolean; auto: string }) {
  return (
    <div className="agr-pills" role="radiogroup">
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} data-auto={`${auto}:${o.value}`} disabled={disabled} onClick={() => onChange(o.value)} className={o.value === value ? "is-on" : ""}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const ReportBuilder = defineWidget<ReportBuilderProps, ReportBuilderAnswer>(function ReportBuilder(w) {
  const { p, active, answer } = w;
  const [type, setType] = useState(p.type);
  const [period, setPeriod] = useState(p.period);
  const [compare, setCompare] = useState(p.compare);
  const [sections, setSections] = useState<Record<string, boolean>>(() => Object.fromEntries(p.sections.map(s => [s.id, s.on])));
  const [format, setFormat] = useState<ReportFormat>(p.format);
  const [to, setTo] = useState<ReportPerson[]>(p.recipients);
  const [schedule, setSchedule] = useState<ReportCadence>(p.schedule);
  const [adding, setAdding] = useState(false);
  const d = !active;
  const label = (opts: Opt[], v: string) => opts.find(o => o.value === v)?.label ?? v;
  const on = p.sections.filter(s => sections[s.id]);
  const pages = Math.max(1, Math.round(on.length * 0.9 + 1));
  const schedules = p.schedules ?? [
    { value: "once", label: "Just this once" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
  ];
  const a = answer;
  const summary = a
    ? `${label(p.types, a.type)} · ${label(p.periods, a.period)}${a.compare !== "none" ? " vs " + label(p.compares, a.compare).toLowerCase() : ""} · ${a.format.toUpperCase()} · ${a.recipients.length} recipient${a.recipients.length === 1 ? "" : "s"}${a.schedule !== "once" ? " · " + a.schedule : ""}`
    : undefined;
  const pool = (p.pool ?? []).filter(x => !to.some(t => t.id === x.id));
  return (
    <Frame
      icon={<FileCog />}
      title={p.title ?? "Report"}
      meta={`${on.length} sections · about ${pages} page${pages === 1 ? "" : "s"}`}
      {...stateOf(w, summary)}
      foot={
        <>
          <span className="ag-foot-hint">
            {format.toUpperCase()} · {to.length ? to.map(t => t.name.split(" ")[0]).join(", ") : "no recipients"}
            {schedule !== "once" ? ` · ${p.when?.[schedule] ?? schedule}` : ""}
          </span>
          <Button variant="primary" data-auto="submit" disabled={d || on.length === 0} onClick={() => w.respond({ type, period, compare, sections: on.map(s => s.id), format, recipients: to, schedule })}>
            {p.cta ?? "Build report"}
          </Button>
        </>
      }
    >
      <div className="agr-form">
        {p.types.length > 1 && (
          <div className="agr-form-r">
            <span className="agr-form-k">Report</span>
            <Pills value={type} options={p.types} onChange={setType} disabled={d} auto="type" />
          </div>
        )}
        <div className="agr-form-r">
          <span className="agr-form-k">Period</span>
          <Pills value={period} options={p.periods} onChange={setPeriod} disabled={d} auto="period" />
        </div>
        {p.compares.length > 0 && (
          <div className="agr-form-r">
            <span className="agr-form-k">Compare to</span>
            <Pills value={compare} options={p.compares} onChange={setCompare} disabled={d} auto="compare" />
          </div>
        )}
        <div className="agr-form-r">
          <span className="agr-form-k">Sections</span>
          <div className="agr-secs">
            {p.sections.map(s => (
              <button key={s.id} type="button" className={`agr-sec ${sections[s.id] ? "is-on" : ""}`} aria-pressed={sections[s.id]} data-auto={"section:" + s.id} disabled={d} title={s.hint} onClick={() => setSections(x => ({ ...x, [s.id]: !x[s.id] }))}>
                <span className="agr-sec-box">{sections[s.id] && <Check />}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="agr-form-r">
          <span className="agr-form-k">Format</span>
          <div className="agr-pills" role="radiogroup">
            {FORMAT.map(f => (
              <button key={f.value} type="button" role="radio" aria-checked={format === f.value} className={format === f.value ? "is-on" : ""} data-auto={"format:" + f.value} disabled={d} onClick={() => setFormat(f.value)}>
                {f.icon}
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="agr-form-r">
          <span className="agr-form-k">Send to</span>
          <div className="agr-rcpts">
            {to.map(r => (
              <span key={r.id} className="agr-rcpt">
                <Avatar name={r.name} size="sm" />
                <span>
                  {r.name}
                  {r.role && <em>{r.role}</em>}
                </span>
                <button type="button" aria-label={`Remove ${r.name}`} data-auto={"rcpt:" + r.id} disabled={d} onClick={() => setTo(t => t.filter(x => x.id !== r.id))}>
                  <X />
                </button>
              </span>
            ))}
            {pool.length > 0 && !adding && (
              <button type="button" className="agr-ghost" disabled={d} data-auto="add" onClick={() => setAdding(true)}>
                <Plus /> Add
              </button>
            )}
            {adding &&
              pool.map(r => (
                <button
                  key={r.id}
                  type="button"
                  className="agr-chip"
                  data-auto={"add:" + r.id}
                  disabled={d}
                  onClick={() => {
                    setTo(t => [...t, r]);
                    setAdding(false);
                  }}
                >
                  <Plus /> {r.name}
                </button>
              ))}
          </div>
        </div>
        <div className="agr-form-r">
          <span className="agr-form-k">Schedule</span>
          <div className="agr-form-v">
            <Pills value={schedule} options={schedules} onChange={v => setSchedule(v as ReportCadence)} disabled={d} auto="schedule" />
            {schedule !== "once" && p.when?.[schedule] && <small className="agr-form-h">{p.when[schedule]}</small>}
          </div>
        </div>
        {p.note && <p className="ag-w-note">{p.note}</p>}
      </div>
    </Frame>
  );
});
