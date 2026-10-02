import React, { useState } from "react";
import { UserRound, CircleAlert } from "lucide-react";
import { Button } from "../../../ui";
import { defineWidget, Frame, stateOf, Toggle } from "../frame";
import type { PersonFormAnswer, PersonFormProps, PersonField } from "./types";
import "../../../styles/agent-frontdesk.css";

// W22 · PersonForm. Prefilled fields (from an ID scan, a reservation or the
// lease) with inline validation. Only the empty required fields need typing.
// Movie mode: "type:<field key>:<text>", optional "toggle", "submit".

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const digits = (s: string) => s.replace(/\D/g, "");

export function formatPhone(s: string) {
  const d = digits(s).replace(/^1(?=\d{10})/, "");
  if (d.length !== 10) return s;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function check(f: PersonField, v: string): string | null {
  const s = v.trim();
  if (!s) return f.required ? "Required" : null;
  if (f.type === "email" && !EMAIL.test(s)) return "Check the email";
  if (f.type === "tel" && digits(s).replace(/^1(?=\d{10})/, "").length !== 10) return "10 digits";
  return null;
}

export const PersonForm = defineWidget<PersonFormProps, PersonFormAnswer>(function PersonForm(w) {
  const { p, active, answer } = w;
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(p.fields.map(f => [f.key, f.value ?? ""])));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [tog, setTog] = useState(p.toggle?.on ?? false);
  const errs = Object.fromEntries(p.fields.map(f => [f.key, check(f, vals[f.key] ?? "")]));
  const bad = Object.values(errs).filter(Boolean).length;
  const filled = p.fields.filter(f => f.value).length;
  const nameKey = p.fields.find(f => /name/i.test(f.key));
  const summary = answer
    ? [answer.first && answer.last ? `${answer.first} ${answer.last}` : nameKey ? answer[nameKey.key] : "", answer.phone, answer.email].filter(Boolean).join(" · ")
    : undefined;

  const submit = () => {
    if (bad) {
      setTouched(Object.fromEntries(p.fields.map(f => [f.key, true])));
      return;
    }
    const out: PersonFormAnswer = {};
    for (const f of p.fields) out[f.key] = f.type === "tel" ? formatPhone(vals[f.key].trim()) : vals[f.key].trim();
    if (p.toggle) out._toggle = tog ? "on" : "off";
    w.respond(out);
  };

  return (
    <Frame
      icon={<UserRound />}
      title={p.title ?? "Details"}
      meta={p.meta ?? (filled ? `${filled} of ${p.fields.length} prefilled` : undefined)}
      {...stateOf(w, summary)}
      foot={
        <>
          {p.toggle ? <Toggle on={tog} onChange={setTog} disabled={!active} auto="toggle" label={p.toggle.label} /> : <span className="agf-foot-sum faint">{bad ? `${bad} field${bad > 1 ? "s" : ""} to fill` : "All fields check out"}</span>}
          <Button variant="primary" data-auto="submit" disabled={!active} onClick={submit}>
            {p.cta ?? "Save details"}
          </Button>
        </>
      }
    >
      <form
        className="agf-form"
        onSubmit={e => {
          e.preventDefault();
          if (active) submit();
        }}
      >
        {p.fields.map(f => {
          const err = (touched[f.key] || (vals[f.key] ?? "") !== (f.value ?? "")) && errs[f.key];
          return (
            <label key={f.key} className={`agf-field ${f.half ? "is-half" : ""} ${err ? "is-err" : ""}`}>
              <span className="agf-field-l">
                {f.label}
                {f.required && <i aria-hidden>*</i>}
                {f.source && f.value && vals[f.key] === f.value && <span className="agf-src mono">{f.source}</span>}
              </span>
              {f.type === "select" ? (
                <select className="z-input" data-auto={f.key} value={vals[f.key]} disabled={!active} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}>
                  {(f.options ?? []).map(o => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="z-input"
                  data-auto={f.key}
                  type={f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"}
                  value={vals[f.key]}
                  placeholder={f.placeholder}
                  disabled={!active}
                  onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                  onBlur={() => setTouched(t => ({ ...t, [f.key]: true }))}
                />
              )}
              {err && (
                <small className="agf-err">
                  <CircleAlert />
                  {err}
                </small>
              )}
            </label>
          );
        })}
        <button type="submit" hidden />
      </form>
      {p.note && <p className="ag-w-note">{p.note}</p>}
    </Frame>
  );
});
