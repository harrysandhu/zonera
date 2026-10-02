import React, { useEffect, useRef, useState } from "react";
import { KeyRound, Send, FileText, PenLine, CreditCard, Lock, ShieldCheck, Upload, Check, ArrowRight, Eye, EyeOff, Landmark, PhoneForwarded, Truck, ChevronDown, Sparkles, type LucideIcon } from "lucide-react";
import { go } from "../../state/store";
import { Button, Pill, Avatar } from "../../ui";
import { fde, ownerDo } from "../fde/engine";
import { MAILS } from "../fde/data/deal";
import type { OwnerItem } from "../fde/types";
import { Quote, Spinner, shortAt } from "./shared";

// One item in Gail's generated checklist. "needs" items render as cards,
// "confirm" items as compact rows; both collapse to a checked row when done.

const KIND_ICON: Partial<Record<OwnerItem["kind"], LucideIcon>> = {
  credential: KeyRound,
  delegate: Send,
  upload: FileText,
  sign: PenLine,
  pay: CreditCard,
};

export function itemValue(item: OwnerItem): string {
  const st = fde.items[item.id];
  const v = st?.value ?? item.prefill?.value;
  switch (item.id) {
    case "O1":
      return v === "exports" ? "Exports uploaded" : "Shared securely · read-only";
    case "O2": {
      if (v === "key") return "API key saved";
      const t = fde.tasks.T10?.state;
      if (t === "done") return "Marcus sent the key";
      if (t === "waiting") return "Asked Marcus · waiting for his reply";
      return "We're emailing Marcus";
    }
    case "O3":
      return `${item.prefill?.file ?? "Lease"} · 14 pages`;
    case "O4":
      return "Day 1 text · Day 6 fee · Day 10 overlock · Day 14 notice";
    case "O5":
    case "O6":
      return item.options?.find(o => o.value === v)?.label ?? "Confirmed";
    case "O7":
      return `${item.prefill?.bank} ${item.prefill?.account}`;
    case "O8":
      return "Invited as manager · no financials";
    case "O9":
      return "Forwarding 6 pm – 9 am";
    case "O10":
      return "Signed";
    case "O11":
      return "Trial until Nov 30 · first invoice Dec 1";
    case "O12":
      return "On · trucks on your storefront";
  }
  return "Done";
}

export function DoneRow({ item }: { item: OwnerItem }) {
  const st = fde.items[item.id];
  return (
    <div className="ob-done" id={`ob-${item.id}`}>
      <span className="ob-check">
        <Check size={13} strokeWidth={2.6} />
      </span>
      <span className="ob-done-t">{item.title}</span>
      <span className="ob-done-v">{itemValue(item)}</span>
      <span className="ob-done-at mono">{shortAt(st?.at)}</span>
    </div>
  );
}

/** A "Needs you" card. */
export function NeedCard({ item }: { item: OwnerItem }) {
  const st = fde.items[item.id];
  if (st.state === "done") return <DoneRow item={item} />;
  const I = KIND_ICON[item.kind] ?? FileText;
  return (
    <article className="ob-card" id={`ob-${item.id}`}>
      <div className="ob-card-h">
        <span className="ob-card-ic">
          <I size={17} />
        </span>
        <div className="ob-card-t">
          <h3>{item.title}</h3>
          <p>{item.why}</p>
        </div>
        <span className="ob-min">{item.minutes < 1 ? "<1" : item.minutes} min</span>
      </div>
      {item.cite && <Quote cite={item.cite} className="ob-card-q" />}
      <div className="ob-card-b">
        <Controls item={item} />
      </div>
    </article>
  );
}

/** A "Quick confirm" row. */
export function ConfirmRow({ item }: { item: OwnerItem }) {
  const st = fde.items[item.id];
  if (st.state === "done") return <DoneRow item={item} />;
  const waiting = st.state === "waiting";
  const isNew = !!item.late;
  return (
    <div className={`ob-row ${isNew ? "ob-row--new" : ""} ${waiting ? "ob-row--wait" : ""}`} id={`ob-${item.id}`}>
      <span className="ob-row-mark">{waiting ? <Spinner size={12} /> : null}</span>
      <div className="ob-row-main">
        <div className="ob-row-h">
          <h4>{item.title}</h4>
          {isNew && (
            <span className="ob-new">
              <Sparkles size={11} /> New · from your email
            </span>
          )}
        </div>
        <p className="ob-row-why">{item.why}</p>
        {item.cite && <Quote cite={item.cite} className="ob-row-q" />}
        <div className="ob-row-b">
          <Controls item={item} />
        </div>
      </div>
    </div>
  );
}

function Controls({ item }: { item: OwnerItem }) {
  switch (item.kind) {
    case "credential":
      return <CredentialCtl item={item} />;
    case "delegate":
      return <DelegateCtl item={item} />;
    case "upload":
      return <UploadCtl item={item} />;
    case "confirm":
      return <ConfirmCtl item={item} />;
    case "choice":
      return <ChoiceCtl item={item} />;
    case "form":
      return item.id === "O7" ? <PayoutCtl item={item} /> : <InviteCtl item={item} />;
    case "sign":
      return (
        <div className="ob-ctl-row">
          <dl className="ob-terms">
            <div><dt>Plan</dt><dd>Professional · $999/mo</dd></div>
            <div><dt>Free</dt><dd>60 days</dd></div>
            <div><dt>Term</dt><dd>12 months · price locked 24</dd></div>
          </dl>
          <Button variant="primary" onClick={() => go("onboard/msa")}>
            Review and sign <ArrowRight />
          </Button>
        </div>
      );
    case "pay": {
      const signed = fde.items.O10?.state === "done";
      return (
        <div className="ob-ctl-row">
          <p className="ob-note">{signed ? "Nothing is charged today. First invoice $999.00 on Dec 1, 2026." : "Comes right after you sign. Nothing is charged today."}</p>
          <Button variant={signed ? "primary" : "default"} onClick={() => go("onboard/billing")}>
            Start subscription <ArrowRight />
          </Button>
        </div>
      );
    }
  }
  return null;
}

// ---- credential (O1) ------------------------------------------------------------

function CredentialCtl({ item }: { item: OwnerItem }) {
  const [user, setUser] = useState(item.prefill?.user ?? "");
  const [pass, setPass] = useState("keystone-2012!");
  const [show, setShow] = useState(false);
  const [alt, setAlt] = useState(false);
  if (alt)
    return (
      <div className="ob-stack">
        <Dropzone
          label="Drop your rent roll and ledger exports"
          hint="CSV, Excel or PDF from Keystone"
          button="Choose files"
          file="Keystone_RentRoll_Ledger_2026-09-30.zip"
          found="181 units · 161 tenants · ledgers back to 2019 · we'll take it from here"
          onDone={() => ownerDo(item.id, "exports")}
        />
        <button type="button" className="ob-link" onClick={() => setAlt(false)}>
          Share your login instead
        </button>
      </div>
    );
  return (
    <div className="ob-stack">
      <div className="ob-grid3">
        <label className="ob-field">
          <span>Keystone address</span>
          <span className="ob-input ob-input--ro">
            <Lock size={12} />
            <span className="mono">{item.prefill?.host}</span>
          </span>
        </label>
        <label className="ob-field">
          <span>Username</span>
          <input className="ob-input" value={user} onChange={e => setUser(e.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        <label className="ob-field">
          <span>Password</span>
          <span className="ob-input-wrap">
            <input className="ob-input" type={show ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} autoComplete="off" />
            <button type="button" className="ob-input-eye" onClick={() => setShow(s => !s)} aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </span>
        </label>
      </div>
      <ul className="ob-trust">
        <li><ShieldCheck size={14} /> Encrypted in our vault</li>
        <li><Eye size={14} /> Read-only</li>
        <li><KeyRound size={14} /> Used only by our migration agent, for this move</li>
        <li><Lock size={14} /> Revoked when you go live</li>
      </ul>
      <div className="ob-ctl-row">
        <button type="button" className="ob-link" onClick={() => setAlt(true)}>
          {item.alt ?? "Upload exports instead"}
        </button>
        <Button variant="primary" onClick={() => ownerDo(item.id, "login")} disabled={!user || !pass}>
          <Lock /> Share securely
        </Button>
      </div>
    </div>
  );
}

// ---- delegate (O2) --------------------------------------------------------------

function DelegateCtl({ item }: { item: OwnerItem }) {
  const [dealer, setDealer] = useState(item.prefill?.dealer ?? "");
  const [contact, setContact] = useState(item.prefill?.contact ?? "");
  const [email, setEmail] = useState(item.prefill?.email ?? "");
  const [preview, setPreview] = useState(false);
  const [alt, setAlt] = useState(false);
  const [key, setKey] = useState("");
  const first = contact.split(" ")[0] || "them";
  if (alt)
    return (
      <div className="ob-stack">
        <label className="ob-field">
          <span>PDK API key</span>
          <input className="ob-input mono" placeholder="pdk_live_…" value={key} onChange={e => setKey(e.target.value)} autoFocus spellCheck={false} />
        </label>
        <div className="ob-ctl-row">
          <button type="button" className="ob-link" onClick={() => setAlt(false)}>
            Ask {first} instead
          </button>
          <Button variant="primary" onClick={() => ownerDo(item.id, "key")} disabled={key.trim().length < 4}>
            Save
          </Button>
        </div>
      </div>
    );
  return (
    <div className="ob-stack">
      <div className="ob-grid3">
        <label className="ob-field">
          <span>Gate dealer</span>
          <input className="ob-input" value={dealer} onChange={e => setDealer(e.target.value)} />
        </label>
        <label className="ob-field">
          <span>Contact</span>
          <input className="ob-input" value={contact} onChange={e => setContact(e.target.value)} />
        </label>
        <label className="ob-field">
          <span>Email</span>
          <input className="ob-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
      </div>
      <button type="button" className={`ob-disclose ${preview ? "is-open" : ""}`} onClick={() => setPreview(p => !p)} aria-expanded={preview}>
        <ChevronDown size={14} /> See the email we'll send
      </button>
      {preview && (
        <div className="ob-mail">
          <div className="ob-mail-h">
            <span>To {contact} &lt;{email}&gt;</span>
            <span>Cc you</span>
          </div>
          <b>{MAILS.dealer.subject}</b>
          <p>{MAILS.dealer.body.replace("Hi Marcus", `Hi ${first}`)}</p>
        </div>
      )}
      <div className="ob-ctl-row">
        <button type="button" className="ob-link" onClick={() => setAlt(true)}>
          {item.alt ?? "Paste the API key instead"}
        </button>
        <Button variant="primary" onClick={() => ownerDo(item.id, "marcus")} disabled={!email}>
          <Send /> Ask {first} for us
        </Button>
      </div>
    </div>
  );
}

// ---- upload (O3) -------------------------------------------------------------------

function UploadCtl({ item }: { item: OwnerItem }) {
  return (
    <Dropzone
      label="Drop your lease here"
      hint="PDF or Word · the March revision"
      button="Choose file"
      file={item.prefill?.file ?? "Lease.pdf"}
      found="14 pages · lien notice on page 9 · $25 late fee on page 4 · we'll use it word for word"
      onDone={() => ownerDo(item.id, item.prefill?.file)}
    />
  );
}

function Dropzone({ label, hint, button, file, found, onDone }: { label: string; hint: string; button: string; file: string; found: string; onDone: () => void }) {
  const [phase, setPhase] = useState<"idle" | "up" | "read" | "found">("idle");
  const [p, setP] = useState(0);
  const [name, setName] = useState(file);
  const [over, setOver] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), []);
  const after = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));

  function start(n?: string) {
    if (phase !== "idle") return;
    if (n) setName(n);
    setPhase("up");
    let v = 0;
    const tick = () => {
      v = Math.min(100, v + 9 + Math.random() * 14);
      setP(v);
      if (v < 100) after(110, tick);
      else {
        setPhase("read");
        after(900, () => {
          setPhase("found");
          after(1500, onDone);
        });
      }
    };
    after(120, tick);
  }

  if (phase === "idle")
    return (
      <div
        className={`ob-drop ${over ? "is-over" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => start()}
        onKeyDown={e => (e.key === "Enter" || e.key === " ") && start()}
        onDragOver={e => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={e => {
          e.preventDefault();
          setOver(false);
          start(e.dataTransfer.files?.[0]?.name);
        }}
      >
        <span className="ob-drop-ic">
          <Upload size={18} />
        </span>
        <span className="ob-drop-t">
          <b>{label}</b>
          <small>{hint}</small>
        </span>
        <span className="z-btn z-btn--sm ob-drop-btn">{button}</span>
      </div>
    );

  return (
    <div className="ob-file">
      <span className="ob-file-ic">
        <FileText size={18} />
      </span>
      <div className="ob-file-m">
        <div className="ob-file-h">
          <b>{name}</b>
          <span className="ob-file-s">
            {phase === "up" ? (
              <span className="mono">{Math.round(p)}%</span>
            ) : phase === "read" ? (
              <>
                <Spinner size={12} /> Reading
              </>
            ) : (
              <>
                <Check size={13} /> Read
              </>
            )}
          </span>
        </div>
        {phase === "found" ? (
          <p className="ob-file-found">{found}</p>
        ) : (
          <div className="ob-bar">
            <i style={{ width: `${phase === "up" ? p : 100}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---- confirm (O4, O9, O12) -------------------------------------------------------------

function ConfirmCtl({ item }: { item: OwnerItem }) {
  let body: React.ReactNode = null;
  if (item.id === "O4") {
    const steps = [
      { d: 1, t: item.prefill?.d1 ?? "Text reminder" },
      { d: 6, t: item.prefill?.d6 ?? "$25 late fee" },
      { d: 10, t: item.prefill?.d10 ?? "Overlock" },
      { d: 14, t: item.prefill?.d14 ?? "Preliminary lien notice" },
    ];
    body = (
      <ol className="ob-tl" aria-label="Late-payment playbook">
        {steps.map(s => (
          <li key={s.d}>
            <i />
            <span className="mono">Day {s.d}</span>
            <b>{s.t}</b>
          </li>
        ))}
      </ol>
    );
  } else if (item.id === "O9") {
    body = (
      <div className="ob-kv">
        <span className="ob-kv-ic"><PhoneForwarded size={15} /></span>
        <div>
          <b className="mono">{item.prefill?.number}</b>
          <small>{item.prefill?.hours} · forwards to Zonera Voice</small>
        </div>
      </div>
    );
  } else if (item.id === "O12") {
    body = (
      <div className="ob-kv">
        <span className="ob-kv-ic"><Truck size={15} /></span>
        <div>
          <b>U-Haul trucks on your storefront</b>
          <small>The agent answers truck questions and books through the dealer portal</small>
        </div>
      </div>
    );
  }
  return (
    <div className="ob-ctl-row ob-ctl-row--top">
      <div className="ob-ctl-main">{body}</div>
      <Button variant="primary" onClick={() => ownerDo(item.id)}>
        {item.id === "O12" ? "Turn on" : "Confirm"}
      </Button>
    </div>
  );
}

// ---- choice (O5, O6) --------------------------------------------------------------------

function ChoiceCtl({ item }: { item: OwnerItem }) {
  const [v, setV] = useState(item.prefill?.value ?? item.options?.[0]?.value ?? "");
  return (
    <div className="ob-stack">
      <div className="ob-radios" role="radiogroup" aria-label={item.title}>
        {item.options?.map(o => (
          <button key={o.value} type="button" role="radio" aria-checked={v === o.value} className="ob-radio" onClick={() => setV(o.value)}>
            <i />
            <span>
              <b>{o.label}</b>
              {o.sub && <small>{o.sub}</small>}
            </span>
          </button>
        ))}
      </div>
      <div className="ob-ctl-row ob-ctl-row--end">
        <Button variant="primary" onClick={() => ownerDo(item.id, v)}>
          Confirm
        </Button>
      </div>
    </div>
  );
}

// ---- forms (O7, O8) -----------------------------------------------------------------------

function PayoutCtl({ item }: { item: OwnerItem }) {
  const st = fde.items[item.id];
  if (st.state === "waiting") {
    const t6 = fde.tasks.T6?.state;
    return (
      <div className="ob-wait">
        <Landmark size={15} />
        <span>
          We'll find this in Keystone. No need to look it up.
          <small>{t6 === "running" || t6 === "queued" ? "Looking in Keystone now" : fde.items.O1?.state === "done" ? "Starting soon" : "Starts once your Keystone login is shared"}</small>
        </span>
      </div>
    );
  }
  return (
    <div className="ob-ctl-row ob-ctl-row--top">
      <div className="ob-ctl-main">
        <div className="ob-bank">
          <span className="ob-kv-ic"><Landmark size={15} /></span>
          <dl>
            <div><dt>Bank</dt><dd>{item.prefill?.bank}</dd></div>
            <div><dt>Routing</dt><dd className="mono">{item.prefill?.routing}</dd></div>
            <div><dt>Account</dt><dd className="mono">{item.prefill?.account}</dd></div>
          </dl>
        </div>
        <small className="ob-found">Found in Keystone · Setup › Deposit accounts</small>
      </div>
      <Button variant="primary" onClick={() => ownerDo(item.id)}>
        Confirm payouts
      </Button>
    </div>
  );
}

function InviteCtl({ item }: { item: OwnerItem }) {
  const [email, setEmail] = useState(item.prefill?.email ?? "");
  return (
    <div className="ob-ctl-row ob-ctl-row--top">
      <div className="ob-ctl-main ob-invite">
        <Avatar name={item.prefill?.name ?? "Priya Raman"} size="sm" />
        <div className="ob-invite-m">
          <b>{item.prefill?.name}</b>
          <input className="ob-input ob-input--sm" type="email" value={email} onChange={e => setEmail(e.target.value)} aria-label="Priya's email" />
        </div>
        <Pill>{item.prefill?.role}</Pill>
      </div>
      <Button variant="primary" onClick={() => ownerDo(item.id, email)} disabled={!email.includes("@")}>
        Send invite
      </Button>
    </div>
  );
}
