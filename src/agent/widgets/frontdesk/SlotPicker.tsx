import React, { useMemo, useState } from "react";
import { CalendarClock, MapPin, Clock } from "lucide-react";
import { Avatar, Button } from "../../../ui";
import { defineWidget, Frame, stateOf } from "../frame";
import type { SlotPickerAnswer, SlotPickerProps } from "./types";
import { dayLabel, dayNum, t12, wk } from "./util";
import "../../../styles/agent-frontdesk.css";

// W33 · SlotPicker. Day strip + time slots + attendee. Shared: tours,
// move-out inspections, vendor visits, lock checks.
// Movie mode: "day:<iso>", "slot:<HH:MM>", "who:<id>", "submit".

const PARTS: [string, (h: number) => boolean][] = [
  ["Morning", h => h < 12],
  ["Afternoon", h => h >= 12 && h < 17],
  ["Evening", h => h >= 17],
];

export const SlotPicker = defineWidget<SlotPickerProps, SlotPickerAnswer>(function SlotPicker(w) {
  const { p, active, answer } = w;
  const firstOpen = useMemo(() => {
    for (const d of p.days) {
      const s = d.slots.find(x => !x.taken);
      if (s && !d.closed) return { iso: d.iso, t: s.t };
    }
    return { iso: p.days[0]?.iso ?? "", t: "" };
  }, [p.days]);
  const [day, setDay] = useState(p.selected?.iso ?? firstOpen.iso);
  const [time, setTime] = useState(p.selected?.t ?? firstOpen.t);
  const [who, setWho] = useState(p.attendee ?? p.attendees?.[0]?.id);
  const cur = p.days.find(d => d.iso === day);
  const person = p.attendees?.find(a => a.id === who);
  const valid = !!cur && !cur.closed && cur.slots.some(s => s.t === time && !s.taken);
  const label = valid ? `${dayLabel(day)} · ${t12(time)}` : "";

  const pickDay = (iso: string) => {
    setDay(iso);
    const d = p.days.find(x => x.iso === iso);
    if (d && !d.slots.some(s => s.t === time && !s.taken)) setTime(d.slots.find(s => !s.taken)?.t ?? "");
  };

  const summary = answer ? `${answer.label}${answer.attendeeName ? ` · with ${answer.attendeeName.split(" ")[0]}` : ""}` : undefined;

  return (
    <Frame
      icon={<CalendarClock />}
      title={p.title ?? "Pick a time"}
      meta={p.meta}
      tier={p.tier}
      {...stateOf(w, summary)}
      foot={
        <>
          <span className="agf-foot-sum">
            {valid ? (
              <>
                <b>{label}</b>
                {p.duration ? <span className="mono"> · {p.duration} min</span> : null}
                {person ? <span> · with {person.name.split(" ")[0]}</span> : null}
              </>
            ) : (
              <span className="faint">Pick a time</span>
            )}
          </span>
          <Button variant="primary" data-auto="submit" disabled={!active || !valid} onClick={() => w.respond({ iso: day, t: time, label, attendee: person?.id, attendeeName: person?.name })}>
            {(p.cta ?? "Book {time}").replace("{time}", valid ? t12(time) : "")}
          </Button>
        </>
      }
    >
      <div className="agf-slots">
        <div className="agf-days" role="tablist" aria-label="Day">
          {p.days.map(d => {
            const open = d.closed ? 0 : d.slots.filter(s => !s.taken).length;
            return (
              <button key={d.iso} type="button" role="tab" aria-selected={d.iso === day} data-auto={"day:" + d.iso} disabled={!active || !!d.closed} className={`agf-day ${d.iso === day ? "is-on" : ""}`} onClick={() => pickDay(d.iso)}>
                <span className="agf-day-w mono">{wk(d.iso)}</span>
                <b className="tnum">{dayNum(d.iso)}</b>
                <small>{d.closed ? "Closed" : `${open} open`}</small>
              </button>
            );
          })}
        </div>
        {cur?.closed ? (
          <p className="agf-empty">{cur.closed}</p>
        ) : (
          <div className="agf-parts">
            {PARTS.map(([name, test]) => {
              const list = (cur?.slots ?? []).filter(s => test(+s.t.slice(0, 2)));
              if (!list.length) return null;
              return (
                <div key={name} className="agf-part">
                  <span className="ag-lbl">{name}</span>
                  <div className="agf-times">
                    {list.map(s => (
                      <button
                        key={s.t}
                        type="button"
                        data-auto={"slot:" + s.t}
                        className={`agf-time ${s.t === time ? "is-on" : ""} ${s.taken ? "is-taken" : ""}`}
                        disabled={!active || s.taken}
                        aria-pressed={s.t === time}
                        title={s.note ?? (s.taken ? "Booked" : undefined)}
                        onClick={() => setTime(s.t)}
                      >
                        {t12(s.t)}
                        {s.note && !s.taken && <i className="agf-time-dot" />}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {(p.attendees?.length || p.where || p.note) && (
          <div className="agf-slot-meta">
            {p.attendees && p.attendees.length > 0 && (
              <div className="agf-who" role="group" aria-label="With">
                <span className="ag-lbl">With</span>
                {p.attendees.map(a => (
                  <button key={a.id} type="button" data-auto={"who:" + a.id} disabled={!active} className={`agf-person ${a.id === who ? "is-on" : ""}`} aria-pressed={a.id === who} onClick={() => setWho(a.id)}>
                    <Avatar name={a.name} size="sm" />
                    <span>{a.name}</span>
                    {a.role && <small>{a.role}</small>}
                  </button>
                ))}
              </div>
            )}
            {p.where && (
              <span className="agf-where">
                <MapPin />
                {p.where}
              </span>
            )}
            {p.duration && (
              <span className="agf-where">
                <Clock />
                {p.duration} min
              </span>
            )}
            {p.note && <p className="ag-w-note">{p.note}</p>}
          </div>
        )}
      </div>
    </Frame>
  );
});
