import React, { useMemo, useState } from "react";
import { ArrowLeft, X, Search, Sparkles, Phone, PhoneOutgoing } from "lucide-react";
import { Avatar } from "../ui";
import { setCallsOpen } from "../state/store";
import { placeCall } from "./engine";
import { contacts, PURPOSES, type Contact, type Purpose } from "./scripts";

// New outbound call: who, why, and whether Zonera Voice or Priya places it.

const SUGGESTED = ["Leila Haddad", "Dana Whitfield", "Owen Murphy", "Matthew Okafor", "Imani Mensah"];

export function Dialer({ onClose, initial }: { onClose: () => void; initial?: string }) {
  const all = useMemo(() => contacts(), []);
  const [q, setQ] = useState(initial ?? "");
  const [sel, setSel] = useState<Contact | null>(null);
  const [purpose, setPurpose] = useState<Purpose>("payment");
  const [custom, setCustom] = useState("");
  const [mode, setMode] = useState<"ai" | "human">("ai");

  const s = q.trim().toLowerCase();
  const results = s
    ? all.filter(c => c.name.toLowerCase().includes(s) || c.phone.replace(/\D/g, "").includes(s.replace(/\D/g, "") || "~") || c.sub.toLowerCase().includes(s)).slice(0, 7)
    : SUGGESTED.map(n => all.find(c => c.name === n)).filter((c): c is Contact => !!c);

  const pick = (c: Contact) => {
    setSel(c);
    setPurpose(c.lead ? "reservation" : /due/.test(c.sub) ? "payment" : "movein");
  };

  const first = sel?.name.split(" ")[0] ?? "";
  const label = PURPOSES.find(p => p.id === purpose)!.label;
  const ready = !!sel && (purpose !== "custom" || custom.trim().length > 2);

  const go = () => {
    if (!sel || !ready) return;
    placeCall(
      {
        name: sel.name,
        phone: sel.phone,
        tenantId: sel.tenantId,
        purpose: purpose === "custom" ? custom.trim() : label,
        kind: purpose,
        scriptId: sel.name === "Leila Haddad" && purpose === "reservation" ? "leila-reservation" : undefined,
      },
      mode,
    );
  };

  return (
    <div className="cc-dial">
      <header className="cc-ph">
        <button type="button" className="z-btn z-btn--ghost z-btn--sm z-iconbtn" aria-label="Back" onClick={onClose}>
          <ArrowLeft />
        </button>
        <span className="cc-ph-t">New call</span>
        <button type="button" className="z-btn z-btn--ghost z-btn--sm z-iconbtn" aria-label="Close calls" onClick={() => setCallsOpen(false)}>
          <X />
        </button>
      </header>
      <div className="cc-dial-b">
        <div className="cc-f">
          <span className="cc-f-l">To</span>
          {sel ? (
            <div className="cc-dial-sel">
              <Avatar name={sel.name} />
              <div>
                <b>{sel.name}</b>
                <span>
                  {sel.sub} · <span className="mono">{sel.phone}</span>
                </span>
              </div>
              <button type="button" className="z-btn z-btn--ghost z-btn--sm" onClick={() => setSel(null)}>
                Change
              </button>
            </div>
          ) : (
            <>
              <label className="cc-search">
                <Search />
                <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search tenants and leads" />
              </label>
              <div className="cc-dial-list">
                {!s && <span className="cc-f-h">Suggested</span>}
                {results.map(c => (
                  <button type="button" key={c.name + c.phone} onClick={() => pick(c)}>
                    <Avatar name={c.name} size="sm" />
                    <span className="cc-dial-n">
                      <b>{c.name}</b>
                      <span>{c.sub}</span>
                    </span>
                    <span className="mono faint">{c.phone}</span>
                  </button>
                ))}
                {s && results.length === 0 && <span className="cc-f-h">No tenants or leads match “{q}”</span>}
              </div>
            </>
          )}
        </div>

        {sel && (
          <>
            <div className="cc-f">
              <span className="cc-f-l">Purpose</span>
              <div className="cc-chips">
                {PURPOSES.map(p => (
                  <button key={p.id} type="button" aria-pressed={purpose === p.id} onClick={() => setPurpose(p.id)}>
                    {p.label}
                  </button>
                ))}
              </div>
              {purpose === "custom" && <input className="z-input" autoFocus value={custom} onChange={e => setCustom(e.target.value)} placeholder="What's the call about?" />}
            </div>
            <div className="cc-f">
              <span className="cc-f-l">Who calls</span>
              <div className="cc-mode">
                <button type="button" aria-pressed={mode === "ai"} onClick={() => setMode("ai")}>
                  <Sparkles />
                  <b>Zonera Voice calls</b>
                  <span>Handles it end to end. Listen in or take over any time.</span>
                </button>
                <button type="button" aria-pressed={mode === "human"} onClick={() => setMode("human")}>
                  <Phone />
                  <b>I'll call</b>
                  <span>You talk. Copilot suggests replies and runs the tools.</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="cc-dial-f">
        <button type="button" className={`z-btn ${mode === "ai" ? "z-btn--accent" : "z-btn--primary"} cc-dial-go`} disabled={!ready} onClick={go}>
          <PhoneOutgoing />
          {sel ? (mode === "ai" ? `Zonera Voice calls ${first}` : `Call ${first}`) : "Choose who to call"}
        </button>
      </div>
    </div>
  );
}
