import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, CornerDownLeft, Menu, X } from "lucide-react";
import { PRESETS } from "../data/catalog";
import { FACILITY, availableUnits, type UnitSize } from "../data/facility";
import { go, movie, sleep, toast, useDemo } from "../state/store";
import { Button, Mark, Modal, Wordmark, typeInto } from "../ui";
import { HERO } from "../assets";
import { Finder, initialFinder, type FinderState } from "./Finder";
import { Business, Faq, Footer, HowItWorks, Location, Reviews, Sizes } from "./Sections";
import { Chat } from "./Chat";
import { startOrder } from "./order";
import { parseStuff } from "./sizing";

const EXAMPLES = ["A one-bedroom and two bikes", "Studio between leases", "Skis, bikes and a kayak", "A three-bedroom house"];

const NAV: [string, string][] = [
  ["st-sizes", "Sizes"],
  ["st-how", "How it works"],
  ["st-location", "Location"],
  ["st-business", "Business"],
];

export function jump(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - (id === "st-finder-panel" ? 72 : 60);
  window.scrollTo({ top: y, behavior: "smooth" });
}

export function Home() {
  useDemo();
  const [fs, setFs] = useState<FinderState>(initialFinder);
  const set = (p: Partial<FinderState>) => setFs(s => ({ ...s, ...p }));
  const [ask, setAsk] = useState("");
  const [askErr, setAskErr] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [tap, setTap] = useState<string | null>(null);
  const free = availableUnits().length;

  const rent = (unitId: string) => {
    startOrder(unitId);
    go("store/checkout");
  };

  const submitAsk = (text = ask) => {
    const p = parseStuff(text);
    if (!p) {
      setAskErr("Try naming a room or a few things, like “a one-bedroom and two bikes”.");
      return false;
    }
    setAskErr(null);
    setFs({ sel: p.sel, preset: p.preset, size: null, picked: null, understood: { text: text.trim(), parts: p.matched } });
    window.setTimeout(() => jump("st-finder-panel"), 60);
    return true;
  };

  const pickSize = (size: UnitSize) => {
    set({ size, picked: null });
    jump("st-finder-panel");
  };

  // Movie mode: describe the stuff, land on the finder, rent the recommended unit.
  const run = useRef(0);
  useEffect(() => {
    if (!movie.on) return;
    const id = ++run.current;
    const alive = () => run.current === id && movie.on;
    (async () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setAsk("");
      setFs(initialFinder());
      await sleep(1400);
      if (!alive()) return;
      document.getElementById("st-ask")?.focus();
      await typeInto("a one-bedroom and two bikes", t => alive() && setAsk(t), 22);
      await sleep(700);
      if (!alive()) return;
      setTap("ask");
      await sleep(220);
      setTap(null);
      submitAsk("a one-bedroom and two bikes");
      await sleep(3200);
      if (!alive()) return;
      setTap("A-126");
      set({ picked: "A-126" });
      await sleep(1600);
      if (!alive()) return;
      setTap("rent");
      await sleep(320);
      if (!alive()) return;
      setTap(null);
      rent("A-126");
    })();
    return () => {
      run.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie.on]);

  return (
    <div className="st-home">
      <header className="st-nav">
        <div className="st-wrap st-nav-in">
          <button className="st-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Zonera Alder Lake, top of page">
            <Mark size={24} />
            <Wordmark size={20} />
            <span className="st-brand-site">Alder Lake</span>
          </button>
          <nav className="st-nav-links">
            {NAV.map(([id, label]) => (
              <button key={id} onClick={() => jump(id)}>
                {label}
              </button>
            ))}
          </nav>
          <div className="st-nav-a">
            <Button variant="ghost" onClick={() => setSignIn(true)} className="st-hide-s">
              Sign in
            </Button>
            <Button variant="primary" onClick={() => jump("st-finder-panel")}>
              Find a unit
            </Button>
            <Button variant="ghost" iconOnly icon={menu ? <X /> : <Menu />} className="st-menu-btn" aria-label="Menu" onClick={() => setMenu(m => !m)} />
          </div>
        </div>
        {menu && (
          <div className="st-menu">
            {NAV.map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  setMenu(false);
                  jump(id);
                }}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => {
                setMenu(false);
                setSignIn(true);
              }}
            >
              Sign in
            </button>
          </div>
        )}
      </header>

      <section className="st-hero">
        <img className="st-hero-img" src={HERO.clean} srcSet={`${HERO.small} 1280w, ${HERO.clean} 2400w`} sizes="100vw" alt="Painted view of Zonera Alder Lake: storage buildings in a meadow above the lake, mountains behind" />
        <div className="st-hero-in">
          <span className="st-hero-pill">
            <i /> {free} units open today · from $79/mo
          </span>
          <h1>
            Storage at Alder Lake.
            <br />
            Rent online in two minutes.
          </h1>
          <form
            className="st-ask"
            onSubmit={e => {
              e.preventDefault();
              submitAsk();
            }}
          >
            <div className="st-ask-h">
              <label htmlFor="st-ask">What are you storing?</label>
              <span>We'll size it and show you the exact door</span>
            </div>
            <div className="st-ask-row">
              <input
                id="st-ask"
                value={ask}
                onChange={e => {
                  setAsk(e.target.value);
                  setAskErr(null);
                }}
                placeholder="A one-bedroom and two bikes"
                autoComplete="off"
                aria-describedby={askErr ? "st-ask-err" : undefined}
              />
              <Button type="submit" variant="primary" size="lg" data-tap={tap === "ask" ? "" : undefined}>
                Find my size <CornerDownLeft />
              </Button>
            </div>
            {askErr ? (
              <p className="st-ask-err" id="st-ask-err" role="alert">
                {askErr}
              </p>
            ) : (
              <div className="st-ask-ex">
                <span>Try</span>
                {EXAMPLES.map(x => (
                  <button
                    type="button"
                    key={x}
                    onClick={() => {
                      setAsk(x);
                      submitAsk(x);
                    }}
                  >
                    {x}
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>
      </section>

      <div className="st-wrap">
        <div className="st-strip">
          <div>
            <span>Rating</span>
            <b>4.9</b>
            <em>312 Google reviews</em>
          </div>
          <div>
            <span>Open today</span>
            <b className="tnum">{free} units</b>
            <em>5×5 to 10×30, plus RV</em>
          </div>
          <div>
            <span>Gate hours</span>
            <b>6 am – 10 pm</b>
            <em>Every day, code by text</em>
          </div>
          <div>
            <span>Terms</span>
            <b>Month to month</b>
            <em>10 days' notice to leave</em>
          </div>
        </div>
      </div>

      <section className="st-sec st-wrap" id="st-finder">
        <SecHead eyebrow="Size finder" title="Find the right size" sub="Pick a preset or count your things. We add 25% for an aisle so you can reach the back, then light up every free unit of that size." />
        <Finder st={fs} set={set} onRent={rent} tapId={tap} />
      </section>

      <section className="st-sec st-wrap" id="st-sizes">
        <SecHead eyebrow="Sizes" title="Seven sizes, one price list" sub="Street rates, no move-in specials that expire. Climate-controlled units are in Building D." />
        <Sizes onPick={pickSize} />
      </section>

      <section className="st-sec st-wrap" id="st-business">
        <Business
          onSize={() => {
            setFs({ sel: { ...PRESETS.find(p => p.id === "business")!.items }, preset: "business", size: null, picked: null, understood: null });
            jump("st-finder-panel");
          }}
        />
      </section>

      <section className="st-sec st-wrap" id="st-how">
        <SecHead eyebrow="How it works" title="From your couch to your unit" sub="No office visit, no paper lease, no waiting for a key." />
        <HowItWorks />
      </section>

      <section className="st-sec st-wrap" id="st-location">
        <SecHead eyebrow="Location" title="On Shoreline Drive, south shore" sub="Five minutes from town, with room to turn a 26-foot truck." />
        <Location />
      </section>

      <section className="st-sec st-wrap" id="st-reviews">
        <SecHead eyebrow="Reviews" title="4.9 from 312 renters" />
        <Reviews />
      </section>

      <section className="st-sec st-wrap st-faq-wrap" id="st-faq">
        <div className="st-faq-h">
          <SecHead eyebrow="Questions" title="Before you rent" sub={`Anything else, call ${FACILITY.phone} or ask the assistant.`} />
        </div>
        <Faq />
      </section>

      <Footer jump={jump} />
      <Chat
        onShowSize={() => {
          setFs({ sel: { ...PRESETS[1].items }, preset: "one-bed", size: null, picked: null, understood: null });
          jump("st-finder-panel");
        }}
      />

      <Modal open={signIn} onClose={() => setSignIn(false)}>
        <SignIn onDone={() => setSignIn(false)} />
      </Modal>
    </div>
  );
}

function SecHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <header className="st-sh">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
    </header>
  );
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="st-signin"
      onSubmit={e => {
        e.preventDefault();
        if (phone.replace(/\D/g, "").length !== 10) {
          setErr("Enter the 10-digit mobile number on your account.");
          return;
        }
        onDone();
        toast({ title: "Sign-in link sent", body: `Check your texts at ${phone}.`, tone: "ok" });
      }}
    >
      <Mark size={28} />
      <h3>Sign in to your account</h3>
      <p>We'll text you a link. No password to remember.</p>
      <input className="z-input" value={phone} onChange={e => setPhone(formatPhone(e.target.value))} placeholder="(530) 555-0198" inputMode="tel" autoFocus aria-label="Mobile number" />
      {err && <span className="st-err">{err}</span>}
      <Button type="submit" variant="primary">
        Text me a link <ArrowRight />
      </Button>
    </form>
  );
}

export function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").replace(/^1/, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
