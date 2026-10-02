import React, { useEffect, useRef, useState } from "react";
import { Check, ScanLine, ShieldCheck } from "lucide-react";
import { Button } from "../ui";
import { getOrder, setOrder } from "./order";

// A drawn (HTML/CSS) driver license, scanned with a sweeping line, OCR fields
// lighting up in order, then four checks. Mock only: nothing leaves the page.

const CHECKS = ["Document is genuine", "Name matches your lease", "Face matches the photo · 98.6%", "Over 18, not expired"];

export function IdScan({ autoStart }: { autoStart?: boolean }) {
  const o = getOrder();
  const [state, setState] = useState<"idle" | "scan" | "check" | "done">(o.idVerified ? "done" : "idle");
  const [field, setField] = useState(o.idVerified ? 99 : -1);
  const [checks, setChecks] = useState(o.idVerified ? CHECKS.length : 0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const start = () => {
    if (state !== "idle") return;
    setState("scan");
    const at = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
    for (let i = 0; i < 7; i++) at(500 + i * 260, () => setField(i));
    at(2500, () => setState("check"));
    CHECKS.forEach((_, i) => at(2700 + i * 380, () => setChecks(i + 1)));
    at(2700 + CHECKS.length * 380 + 150, () => {
      setState("done");
      setOrder({ idVerified: true });
    });
  };

  useEffect(() => {
    if (autoStart) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const f = (i: number) => (field >= i ? "on" : "");
  const first = (o.first || "Maya").toUpperCase();
  const last = (o.last || "Chen").toUpperCase();

  return (
    <div className={`st-id st-id--${state}`}>
      <div className="st-id-stage">
        <div className="st-dl" aria-label="Driver license preview">
          <div className="st-dl-guil" />
          <div className="st-dl-top">
            <b>DRIVER LICENSE</b>
            <span>USA · CA</span>
          </div>
          <div className="st-dl-body">
            <div className="st-dl-photo">
              <i className="h" />
              <i className="b" />
            </div>
            <dl>
              <div className={`w ${f(0)}`}>
                <dt>DL</dt>
                <dd className="st-dl-num">D4829117</dd>
              </div>
              <div className={f(1)}>
                <dt>EXP</dt>
                <dd>08/14/2030</dd>
              </div>
              <div className={`w ${f(2)}`}>
                <dt>LN</dt>
                <dd className="big">{last}</dd>
              </div>
              <div className={`w ${f(3)}`}>
                <dt>FN</dt>
                <dd className="big">{first}</dd>
              </div>
              <div className={`w ${f(4)}`}>
                <dd>418 PINE ST, ALDER LAKE CA 96150</dd>
              </div>
              <div className={f(5)}>
                <dt>DOB</dt>
                <dd className="red">03/22/1994</dd>
              </div>
              <div className={f(6)}>
                <dt>HGT</dt>
                <dd>5-06 · BRN</dd>
              </div>
            </dl>
          </div>
          <div className="st-dl-sig">{(o.first || "Maya") + " " + (o.last || "Chen")}</div>
          <div className="st-dl-ghost">
            <i className="h" />
            <i className="b" />
          </div>
          {state === "scan" && <div className="st-dl-line" />}
        </div>
        <span className="st-id-c st-c-tl" />
        <span className="st-id-c st-c-tr" />
        <span className="st-id-c st-c-bl" />
        <span className="st-id-c st-c-br" />
      </div>

      <div className="st-id-side">
        {state === "idle" && (
          <>
            <p className="st-id-tip">Hold your license flat in good light. We read the front and match it to a quick selfie.</p>
            <Button variant="primary" size="lg" onClick={start} data-enter="native">
              <ScanLine /> Scan my ID
            </Button>
          </>
        )}
        {state === "scan" && (
          <p className="st-id-status">
            <span className="st-spin" /> Reading the front of your license…
          </p>
        )}
        {(state === "check" || state === "done") && (
          <ul className="st-id-checks">
            {CHECKS.map((c, i) => (
              <li key={c} className={i < checks ? "on" : ""}>
                <span>{i < checks ? <Check /> : <span className="st-spin" />}</span>
                {c}
              </li>
            ))}
          </ul>
        )}
        {state === "done" && (
          <div className="st-id-ok">
            <ShieldCheck /> Verified in 4.1 seconds
          </div>
        )}
      </div>
    </div>
  );
}
