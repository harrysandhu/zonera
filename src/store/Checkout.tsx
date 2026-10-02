import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronUp, CornerDownLeft, Phone } from "lucide-react";
import { FACILITY, UNIT_BY_ID } from "../data/facility";
import { TENANTS, TENANT_BY_ID, type Tenant } from "../data/tenants";
import { commit, go, movie, sleep, useDemo } from "../state/store";
import { Button, Mark, typeInto } from "../ui";
import { FacilityView } from "../three/FacilityView";
import { DEFAULTS, GATE_CODE, getOrder, kindLabel, setOrder, sizeLabel, unitFacts, unitOrDefault, useOrder, type Order } from "./order";
import { money, quote } from "./pricing";
import { cardLabel, formatCard, formatPhone, validateStep, type Errors } from "./validate";
import { ContactStep, DateStep, DurationStep, IdStep, LeaseStep, NameStep, PaymentStep, PlanStep, ProtectionStep, STEPS, STEP_COPY, type StepId, type StepProps } from "./Steps";

const VIEWS: Record<StepId, (p: StepProps) => JSX.Element> = {
  date: DateStep,
  duration: DurationStep,
  name: NameStep,
  contact: ContactStep,
  protection: ProtectionStep,
  plan: PlanStep,
  id: IdStep,
  payment: PaymentStep,
  lease: LeaseStep,
};

const HOLD_SECONDS = 10 * 60;

export function Checkout() {
  useDemo();
  const o = useOrder();
  const unit = unitOrDefault(o.unitId);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [errs, setErrs] = useState<Errors>({});
  const [shake, setShake] = useState(0);
  const [tap, setTap] = useState<string | null>(null);
  const [sumOpen, setSumOpen] = useState(false);
  const [done, setDone] = useState<number>(-1); // processing progress after signing
  const [held, setHeld] = useState(HOLD_SECONDS);
  const step = STEPS[i].id;
  const q = quote(o);
  const last = i === STEPS.length - 1;
  const copy = STEP_COPY[step];
  const View = VIEWS[step];

  useEffect(() => {
    if (!UNIT_BY_ID.get(o.unitId)) setOrder({ unitId: "A-126" });
    const t = window.setInterval(() => setHeld(h => Math.max(0, h - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const next = () => {
    if (done >= 0) return;
    const e = validateStep(step, getOrder());
    if (Object.keys(e).length) {
      setErrs(e);
      setShake(s => s + 1);
      return;
    }
    setErrs({});
    if (last) {
      finish();
      return;
    }
    setDir(1);
    setI(i + 1);
  };
  const back = () => {
    if (done >= 0) return;
    setErrs({});
    if (i === 0) go("store");
    else {
      setDir(-1);
      setI(i - 1);
    }
  };
  const nextRef = useRef(next);
  nextRef.current = next;

  // Enter continues; Escape goes back.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "Enter" && !e.shiftKey) {
        if (t?.tagName === "TEXTAREA") return;
        if (t?.dataset?.enter === "native" || t?.closest?.("[data-enter='native']")) return;
        e.preventDefault();
        nextRef.current();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  // Clear a field's error as soon as it changes.
  useEffect(() => {
    if (!Object.keys(errs).length) return;
    const e = validateStep(step, o);
    const keep: Errors = {};
    for (const k of Object.keys(errs)) if (e[k]) keep[k] = errs[k];
    if (Object.keys(keep).length !== Object.keys(errs).length) setErrs(keep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o]);

  // ---- Finish: charge, countersign, issue the code, update the facility ----------
  const finish = async () => {
    setDone(0);
    setOrder({ signedAt: new Date().toISOString() });
    for (let k = 1; k <= 4; k++) {
      await sleep(k === 1 ? 900 : 700);
      setDone(k);
    }
    await sleep(600);
    moveIn(getOrder());
    go("store/access");
  };

  // ---- Movie mode: type the answers and continue at a watchable pace ----------------
  const run = useRef(0);
  useEffect(() => {
    if (!movie.on || done >= 0) return;
    const id = ++run.current;
    const alive = () => run.current === id && movie.on;
    const wait = async (ms: number) => {
      await sleep(ms);
      if (!alive()) throw new Error("stopped");
    };
    const press = async (key: string, ms = 240) => {
      setTap(key);
      await wait(ms);
      setTap(null);
    };
    const type = async (field: keyof Order, text: string, f: (s: string) => string = s => s) => {
      setOrder({ [field]: "" } as Partial<Order>);
      await wait(260);
      await typeInto(text, s => alive() && setOrder({ [field]: f(s) } as Partial<Order>), 20);
      await wait(200);
    };
    const go_ = async (ms = 650) => {
      await wait(ms);
      setTap("next");
      await wait(240);
      setTap(null);
      nextRef.current();
    };
    const scripts: Record<StepId, () => Promise<void>> = {
      date: async () => {
        await wait(1100);
        await press("date:2", 380);
        setOrder({ moveIn: "2026-10-02" });
        await go_(900);
      },
      duration: async () => {
        await wait(900);
        await press("duration:3–6 months", 300);
        setOrder({ duration: "3–6 months" });
        await go_(800);
      },
      name: async () => {
        await wait(500);
        await type("first", DEFAULTS.first);
        await type("last", DEFAULTS.last);
        await go_();
      },
      contact: async () => {
        await wait(500);
        await type("email", DEFAULTS.email);
        await type("phone", "5305550198", formatPhone);
        await go_();
      },
      protection: async () => {
        await wait(900);
        await press("protection:5000", 320);
        setOrder({ protection: 5000 });
        await go_(900);
      },
      plan: async () => {
        await wait(900);
        await press("plan:monthly", 320);
        setOrder({ plan: "monthly", autopay: true });
        await go_(1100);
      },
      id: async () => {
        await wait(900);
        setTap("scan");
        while (!getOrder().idVerified) await wait(150);
        setTap(null);
        await go_(1100);
      },
      payment: async () => {
        await wait(700);
        setOrder({ pay: "card" });
        await type("card", "4242424242424242", formatCard);
        await type("exp", "0829", s => (s.length > 2 ? s.slice(0, 2) + "/" + s.slice(2) : s));
        await type("cvc", DEFAULTS.cvc);
        await type("zip", DEFAULTS.zip);
        await go_(900);
      },
      lease: async () => {
        await wait(1600);
        await type("signature", `${getOrder().first} ${getOrder().last}`);
        await wait(300);
        await press("agree", 260);
        setOrder({ agreed: true });
        await go_(900);
      },
    };
    scripts[step]().catch(() => {});
    return () => {
      run.current++;
      setTap(null);
    };
  }, [movie.on, step, done]);

  const pct = ((i + (done >= 0 ? 1 : 0)) / STEPS.length) * 100;
  const mm = String(Math.floor(held / 60));
  const ss = String(held % 60).padStart(2, "0");

  return (
    <div className="st-co">
      <aside className="st-co-l">
        <FacilityView
          mode="store"
          selected={unit.id}
          fly
          zoom={unit.kind === "climate" ? 2.1 : 2.4}
          labels={[
            {
              key: "mine",
              unitId: unit.id,
              lift: 3,
              children: (
                <div className="st-tag3d">
                  <b>{unit.id}</b>
                  <span>Your unit</span>
                </div>
              ),
            },
          ]}
        />
        <div className="st-co-top">
          <button className="st-back" onClick={() => go("store")}>
            <ArrowLeft /> Alder Lake
          </button>
          <span className="st-held mono" title="We hold the unit while you check out">
            <i /> Held for you · {mm}:{ss}
          </span>
        </div>
        <div className="st-co-unit">
          <span className="eyebrow">Your unit</span>
          <div className="st-co-unit-h">
            <b>{unit.id}</b>
            <span>
              {sizeLabel(unit.size)} · {kindLabel(unit)}
            </span>
            <em className="tnum">
              ${unit.rate}
              <small>/mo</small>
            </em>
          </div>
          <ul>
            {unitFacts(unit).map(f => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <button className="st-link" onClick={() => go("store")}>
            Change unit
          </button>
        </div>
      </aside>

      <section className="st-co-r">
        <header className="st-co-h">
          <div className="st-co-brand">
            <Mark size={22} />
            <span>Rent {unit.id}</span>
          </div>
          <div className="st-prog" aria-label={`Step ${i + 1} of ${STEPS.length}`}>
            <span className="mono">
              {String(i + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
            </span>
            <span className="st-prog-l">{STEPS[i].label}</span>
          </div>
          <a className="st-help" href={`tel:${FACILITY.phone.replace(/\D/g, "")}`}>
            <Phone /> {FACILITY.phone}
          </a>
          <div className="st-prog-bar">
            <i style={{ width: `${pct}%` }} />
          </div>
        </header>

        <div className="st-co-main">
          {done >= 0 ? (
            <Processing o={o} q={q.dueToday} done={done} />
          ) : (
            <div key={step} className={`st-q ${dir > 0 ? "st-q--up" : "st-q--down"}`}>
              <div className="st-q-h">
                <span className="st-q-n mono">
                  {i + 1}
                  <ArrowRight />
                </span>
                <h1>{copy.q(o)}</h1>
                {copy.sub && <p>{copy.sub(o)}</p>}
              </div>
              <div className={`st-q-b ${shake ? "st-shake" : ""}`} key={shake}>
                <View o={o} errs={errs} tap={tap} next={next} />
              </div>
              <div className="st-q-a">
                {i > 0 && (
                  <Button size="lg" onClick={back} data-enter="native" className="st-q-back">
                    <ArrowLeft /> Back
                  </Button>
                )}
                <Button variant="primary" size="lg" onClick={next} data-tap={tap === "next" ? "" : undefined} data-enter="native">
                  {last ? (
                    <>
                      Sign and pay {money(q.dueToday)}
                    </>
                  ) : (
                    <>
                      Continue <Check />
                    </>
                  )}
                </Button>
                <span className="st-enter">
                  press <b>Enter</b> <CornerDownLeft />
                </span>
              </div>
            </div>
          )}
        </div>

        <div className={`st-sum ${sumOpen ? "open" : ""}`}>
          {sumOpen && (
            <div className="st-sum-b">
              <dl>
                <div>
                  <dt>Move-in</dt>
                  <dd>{new Date(2026, 9, Number(o.moveIn.slice(8, 10))).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</dd>
                </div>
                <div>
                  <dt>Plan</dt>
                  <dd>{o.plan === "prepay" ? "Prepay through Apr 30, 10% off rent" : "Monthly"}{o.autopay ? " · autopay" : ""}</dd>
                </div>
                <div>
                  <dt>Protection</dt>
                  <dd>{q.protectionLabel}</dd>
                </div>
              </dl>
              <div className="st-due st-due--flat">
                {q.lines.map(l => (
                  <div key={l.label} className={l.tone === "discount" ? "disc" : ""}>
                    <span>
                      {l.label}
                      {l.note && <em>{l.note}</em>}
                    </span>
                    <span className="tnum">{money(l.amount)}</span>
                  </div>
                ))}
                <p>
                  Then {money(q.monthly)}/mo from {q.nextCharge}.
                </p>
              </div>
            </div>
          )}
          <button className="st-sum-bar" onClick={() => setSumOpen(s => !s)} aria-expanded={sumOpen} data-enter="native">
            <span className="st-sum-u">
              <b className="mono">{unit.id}</b> {sizeLabel(unit.size)} {unit.kind === "climate" ? "climate" : unit.kind === "parking" ? "parking" : "drive-up"}
              <em>
                ${q.rate}/mo{q.protection ? ` + $${q.protection} protection` : ""}
              </em>
            </span>
            <span className="st-sum-t">
              <em>Due today</em>
              <b className="tnum">{money(q.dueToday)}</b>
            </span>
            <ChevronUp className="st-sum-c" />
          </button>
        </div>
      </section>
    </div>
  );
}

function Processing({ o, q, done }: { o: Order; q: number; done: number }) {
  const items = [
    `Charging ${cardLabel(o)} · ${money(q)}`,
    "Countersigning your lease",
    `Issuing gate code for ${o.unitId}`,
    `Texting directions to ${o.phone}`,
  ];
  return (
    <div className="st-proc">
      <h1>Setting up {o.unitId}</h1>
      <ul>
        {items.map((t, k) => (
          <li key={t} className={done > k ? "on" : done === k ? "now" : ""}>
            <span>{done > k ? <Check /> : done === k ? <span className="st-spin" /> : <i />}</span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Write the rental into the facility data so every operator screen sees it. */
function moveIn(o: Order) {
  const u = UNIT_BY_ID.get(o.unitId);
  if (!u || o.tenantId) return;
  let n = 1000 + TENANTS.length;
  while (TENANT_BY_ID.has(`T-${n}`)) n++;
  const q = quote(o);
  const t: Tenant = {
    id: `T-${n}`,
    first: o.first.trim(),
    last: o.last.trim(),
    name: `${o.first.trim()} ${o.last.trim()}`,
    email: o.email.trim(),
    phone: o.phone,
    unitIds: [u.id],
    rent: o.plan === "prepay" ? Math.round(u.rate * 0.9 * 100) / 100 : u.rate,
    balance: 0,
    daysLate: 0,
    autopay: o.autopay,
    card: cardLabel({ ...o, pay: "card" }),
    moveIn: o.moveIn,
    protection: o.protection === "own" ? 0 : o.protection,
    lastContact: "Oct 2 · Welcome text with gate code",
    notes: `Rented online. ID verified. Paid ${money(q.dueToday)} at signing${o.plan === "prepay" ? ", prepaid through Apr 30" : ""}.${o.protection === "own" ? ` Own insurance: ${o.ownInsurer}.` : ""}`,
    gateCode: GATE_CODE,
  };
  TENANTS.push(t);
  TENANT_BY_ID.set(t.id, t);
  u.status = "occupied";
  u.tenantId = t.id;
  setOrder({ tenantId: t.id });
  commit({ kind: "movein", text: `${t.name} rented ${u.id} online. Lease signed, gate code issued.`, who: "Storefront" });
}
