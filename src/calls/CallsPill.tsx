import React, { useEffect } from "react";
import { PhoneIncoming, TriangleAlert } from "lucide-react";
import { nav, setCallsOpen, useDemo } from "../state/store";
import { useCallsSel, ui, bump } from "./state";
import { ensureStarted, liveCalls } from "./engine";
import { MiniWave } from "./Wave";
import type { Speaker } from "./types";
import "../styles/calls.css";

// Top-bar pill: live count with a tiny waveform; rings for incoming calls and
// turns amber when Zonera Voice asks for a human. Toggles the push-in panel.

export function CallsPill() {
  useDemo();
  useEffect(() => {
    ensureStarted();
  }, []);
  const sig = useCallsSel(() => {
    const live = liveCalls();
    const ringing = live.find(c => c.status === "ringing");
    const alert = live.find(c => c.alert);
    const speaking = live.find(c => c.status === "live" && c.speaking)?.speaking ?? "";
    return [live.filter(c => c.status === "live").length, ringing?.id ?? "", ringing?.name ?? "", alert?.id ?? "", alert?.name ?? "", speaking].join("|");
  });
  const [n, ringId, ringName, alertId, alertName, speaking] = sig.split("|");
  const state = alertId ? "alert" : ringId ? "ring" : "idle";

  const click = () => {
    const target = alertId || ringId;
    if (target && (!nav.callsOpen || ui.focus !== target)) {
      ui.focus = target;
      ui.tab = "live";
      ui.dial = false;
      bump();
      setCallsOpen(true);
      return;
    }
    setCallsOpen(!nav.callsOpen);
  };

  return (
    <button type="button" className={`cc-pill cc-pill--${state}`} aria-pressed={nav.callsOpen} onClick={click} aria-label="Calls">
      {state === "ring" ? (
        <>
          <span className="cc-pill-ring">
            <PhoneIncoming />
          </span>
          <span className="cc-pill-t">Incoming · {ringName === "New caller" ? "new caller" : ringName}</span>
        </>
      ) : state === "alert" ? (
        <>
          <TriangleAlert />
          <span className="cc-pill-t">{alertName.split(" ")[0]} needs you</span>
        </>
      ) : (
        <>
          <MiniWave speaking={(speaking || null) as Speaker | null} />
          <span className="cc-pill-t">
            <b className="tnum">{n}</b> live
          </span>
        </>
      )}
    </button>
  );
}
