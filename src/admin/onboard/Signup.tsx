import React, { useEffect, useRef, useState } from "react";
import { Building2, MapPin, LayoutGrid, Database, KeyRound, Star, ArrowRight, Check, Mail } from "lucide-react";
import { go } from "../../state/store";
import { Button, typeInto } from "../../ui";
import { fde, startFde } from "../fde/engine";
import { Spinner } from "./shared";

// Gmail-simple: two fields, then the agent finds the facility on its own.

const EMAIL = "gail@brennanstorage.com";
const ADDRESS = "2200 Shoreline Drive, Alder Lake, CA 96150";

const FOUND = [
  { icon: Building2, label: "Alder Lake Self Storage", src: "Business listing" },
  { icon: MapPin, label: "2200 Shoreline Drive", src: "Alder Lake, CA 96150 · parcel 032-141-07" },
  { icon: LayoutGrid, label: "181 units", src: "2014 site plan, county permits" },
  { icon: Database, label: "Runs Keystone 8.4", src: "The pay-online link on your website" },
  { icon: KeyRound, label: "PDK gate", src: "2019 gate permit · Sierra Access & Security" },
  { icon: Star, label: "Google 4.6 (212 reviews)", src: "Google Business Profile" },
];

function begin() {
  if (fde.run === "idle") startFde();
}

export function Signup() {
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [phase, setPhase] = useState<"form" | "filling" | "finding">("form");
  const [shown, setShown] = useState(0);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (phase !== "finding" || shown >= FOUND.length) return;
    timer.current = window.setTimeout(() => setShown(n => n + 1), shown === 0 ? 700 : 520);
    return () => window.clearTimeout(timer.current);
  }, [phase, shown]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (phase !== "form") return;
    setPhase("filling");
    if (!email.trim()) await typeInto(EMAIL, setEmail, 70);
    if (!address.trim()) await typeInto(ADDRESS, setAddress, 70);
    setShown(0);
    setPhase("finding");
  }

  const done = phase === "finding" && shown >= FOUND.length;

  return (
    <div className="ob-signup">
      {phase !== "finding" ? (
        <form className="ob-signup-card" onSubmit={submit} noValidate>
          <h1 className="ob-h1">Move your facility to Zonera</h1>
          <p className="ob-lede">Your email and your address. We'll find the rest.</p>
          <div className="ob-fields">
            <label className="ob-field">
              <span>Work email</span>
              <input className="ob-input" type="email" autoComplete="email" placeholder="you@yourfacility.com" value={email} onChange={e => setEmail(e.target.value)} readOnly={phase === "filling"} />
            </label>
            <label className="ob-field">
              <span>Facility address</span>
              <input className="ob-input" type="text" autoComplete="street-address" placeholder="Street, city" value={address} onChange={e => setAddress(e.target.value)} readOnly={phase === "filling"} />
            </label>
          </div>
          <Button type="submit" variant="primary" size="lg" className="ob-wide" disabled={phase === "filling"}>
            Continue <ArrowRight />
          </Button>
          <button
            type="button"
            className="ob-signup-alt"
            onClick={() => {
              begin();
              go("onboard/home");
            }}
          >
            <Mail size={15} />
            <span>
              Talked to Jordan already? <u>Your link is in your email.</u>
            </span>
          </button>
        </form>
      ) : (
        <div className="ob-signup-card">
          <div className="ob-find-h">
            {done ? <span className="ob-find-ok"><Check size={14} /></span> : <Spinner size={16} />}
            <div>
              <h1 className="ob-h2">{done ? "Is this your facility?" : "Looking up your facility"}</h1>
              <p className="ob-meta">
                {email} · {address.split(",")[0]}
              </p>
            </div>
          </div>
          <ol className="ob-find">
            {FOUND.map((f, i) => {
              const I = f.icon;
              const on = i < shown;
              const next = i === shown && !done;
              return (
                <li key={f.label} className={on ? "is-on" : next ? "is-next" : ""}>
                  <span className="ob-find-ic">
                    <I size={15} />
                  </span>
                  {on ? (
                    <span className="ob-find-t">
                      <b>{f.label}</b>
                      <small>{f.src}</small>
                    </span>
                  ) : (
                    <span className="ob-find-t">
                      <i className="ob-skel" style={{ width: 120 + ((i * 37) % 80) }} />
                      <i className="ob-skel ob-skel--sm" style={{ width: 160 + ((i * 53) % 70) }} />
                    </span>
                  )}
                  {on && <Check size={15} className="ob-find-check" />}
                </li>
              );
            })}
          </ol>
          <div className={`ob-find-actions ${done ? "is-on" : ""}`}>
            <Button
              variant="primary"
              size="lg"
              disabled={!done}
              onClick={() => {
                begin();
                go("onboard/home");
              }}
            >
              That's us <ArrowRight />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                setPhase("form");
                setShown(0);
              }}
            >
              Not quite
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
