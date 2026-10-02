import React, { useRef, useState } from "react";
import { MessagesSquare, Mail, MessageSquare, ChevronLeft, ChevronRight, Braces } from "lucide-react";
import { Avatar, Button } from "../../../ui";
import { defineWidget, Frame, Seg, stateOf } from "../frame";
import { reachable } from "./RecipientSet";
import type { BulkMessageAnswer, BulkMessageProps, MsgTone, Recipient } from "./types";

/** Fill {first} {unit} {balance} … from a recipient's merge data. */
export function merge(tpl: string, r: Recipient) {
  const d: Record<string, string> = { first: r.name.split(" ")[0], name: r.name, unit: r.sub ?? "", ...r.data };
  return tpl.replace(/\{(\w+)\}/g, (m, k) => d[k] ?? m);
}

const TONES: { value: MsgTone; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "firm", label: "Firm" },
  { value: "brief", label: "Brief" },
];

// W4 · Channel, tone, template with merge fields, per-recipient preview, schedule.
// Movie mode: optional "channel:email", "tone:firm", "type:body:…", "next", then "submit".
export const BulkMessageComposer = defineWidget<BulkMessageProps, BulkMessageAnswer>(function BulkMessageComposer(w) {
  const { p, active, locked, answer } = w;
  const [channel, setChannel] = useState(p.channel);
  const tones = TONES.filter(t => p.templates[t.value]);
  const [tone, setTone] = useState<MsgTone>(p.tone ?? tones[0]?.value ?? "friendly");
  const [tpl, setTpl] = useState<Record<string, string>>(() => ({ ...p.templates }) as Record<string, string>);
  const [drafts, setDrafts] = useState<Record<string, string> | undefined>(p.drafts ? { ...p.drafts } : undefined);
  const [subject, setSubject] = useState(p.subject ?? "");
  const [idx, setIdx] = useState(0);
  const [schedule, setSchedule] = useState(p.schedule ?? "now");
  const ta = useRef<HTMLTextAreaElement>(null);
  const r = p.recipients[Math.min(idx, p.recipients.length - 1)];
  const template = tpl[tone] ?? "";
  const body = drafts ? drafts[r.id] ?? "" : template;
  const preview = merge(body, r);
  const fields = p.fields ?? ["first", "unit", "balance", "due_date"];
  const n = p.recipients.length;
  const noun = channel === "sms" ? (n === 1 ? "text" : "texts") : n === 1 ? "email" : "emails";
  const segs = Math.max(1, Math.ceil(preview.length / 160));

  const setBody = (v: string) => {
    if (drafts) setDrafts(d => ({ ...d!, [r.id]: v }));
    else setTpl(t => ({ ...t, [tone]: v }));
  };
  const insert = (f: string) => {
    const el = ta.current;
    const tok = `{${f}}`;
    if (!el) return setBody(body + tok);
    const a = el.selectionStart ?? body.length;
    const b = el.selectionEnd ?? body.length;
    setBody(body.slice(0, a) + tok + body.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + tok.length, a + tok.length);
    });
  };
  const submit = () =>
    w.respond({
      channel,
      subject: channel === "email" ? subject : undefined,
      tone,
      template,
      schedule,
      messages: p.recipients.map(x => {
        const fallback = reachable(x, channel);
        const to = fallback ? (channel === "email" ? x.phone : x.email) : channel === "email" ? x.email : x.phone;
        return { id: x.id, name: x.name, to: to ?? "", text: merge(drafts ? drafts[x.id] ?? "" : template, x) };
      }),
    });

  if (locked && answer) {
    return (
      <Frame icon={<MessagesSquare />} title={`${answer.messages.length} ${answer.channel === "sms" ? "texts" : "emails"}`} {...stateOf(w, `${answer.messages.length} ${answer.channel === "sms" ? "texts" : "emails"} · ${answer.tone} · ${answer.schedule === "now" ? "sent now" : answer.schedule === "tomorrow" ? "tomorrow 9:00 am" : "scheduled"}`)}>
        <div className="ag-bm-sent">
          {answer.subject && (
            <div className="ag-bm-subj">
              <span className="ag-lbl">Subject</span> {answer.subject}
            </div>
          )}
          <p>{answer.messages[0]?.text}</p>
        </div>
      </Frame>
    );
  }

  return (
    <Frame
      icon={<MessagesSquare />}
      title={`Compose ${n} ${noun}`}
      meta={channel === "sms" ? `${preview.length} chars · ${segs} segment${segs > 1 ? "s" : ""}` : undefined}
      {...stateOf(w)}
      tier="Ask first"
      foot={
        <>
          <Seg
            value={schedule}
            disabled={!active}
            auto="schedule"
            onChange={v => setSchedule(v)}
            options={[
              { value: "now", label: "Now" },
              { value: "tomorrow", label: "9:00 am tomorrow" },
            ]}
          />
          <Button variant="primary" data-auto="submit" disabled={!active || !preview.trim()} onClick={submit}>
            {schedule === "now" ? "Send" : "Schedule"} {n} {noun}
          </Button>
        </>
      }
    >
      <div className="ag-bm">
        <div className="ag-bm-top">
          {(p.channels ?? ["sms", "email"]).length > 1 && (
            <Seg
              value={channel}
              disabled={!active}
              auto="channel"
              onChange={v => setChannel(v)}
              options={(p.channels ?? ["sms", "email"]).map(c => ({ value: c, label: c === "sms" ? "SMS" : "Email", icon: c === "sms" ? <MessageSquare /> : <Mail /> }))}
            />
          )}
          {!drafts && tones.length > 1 && <Seg value={tone} disabled={!active} auto="tone" onChange={v => setTone(v)} options={tones} />}
        </div>
        {channel === "email" && (
          <label className="ag-bm-subject">
            <span className="ag-lbl">Subject</span>
            <input className="z-input" data-auto="subject" value={subject} disabled={!active} onChange={e => setSubject(e.target.value)} placeholder="Subject" />
          </label>
        )}
        <div className="ag-bm-edit">
          <textarea ref={ta} className="z-input" data-auto="body" rows={drafts ? 3 : 4} value={body} disabled={!active} onChange={e => setBody(e.target.value)} />
          <div className="ag-bm-fields">
            <Braces />
            {fields.map(f => (
              <button key={f} type="button" disabled={!active} onClick={() => insert(f)}>
                {"{" + f + "}"}
              </button>
            ))}
            {drafts && <span className="ag-bm-own">Personal draft for {r.name.split(" ")[0]}</span>}
          </div>
        </div>
        <div className="ag-bm-pv">
          <div className="ag-bm-pvh">
            <Avatar name={r.name} size="sm" />
            <b>{r.name}</b>
            <span className="mono">{channel === "email" ? r.email ?? r.phone : r.phone}</span>
            <span className="ag-bm-pager">
              <button type="button" data-auto="prev" aria-label="Previous recipient" disabled={idx === 0} onClick={() => setIdx(i => i - 1)}>
                <ChevronLeft />
              </button>
              <span className="mono">
                {idx + 1} of {n}
              </span>
              <button type="button" data-auto="next" aria-label="Next recipient" disabled={idx >= n - 1} onClick={() => setIdx(i => i + 1)}>
                <ChevronRight />
              </button>
            </span>
          </div>
          <div className={`ag-bm-msg ag-bm-msg--${channel}`}>
            {channel === "email" && subject && <b>{merge(subject, r)}</b>}
            <p>{preview}</p>
          </div>
          {reachable(r, channel) && <small className="ag-bm-fb">{reachable(r, channel)}. Sends by {channel === "email" ? "text" : "email"} instead.</small>}
        </div>
      </div>
    </Frame>
  );
});
