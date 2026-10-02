import { agent, newSession, uid, type Block, type Session, type ToolCall } from "./engine";

// The workspace opens with a fresh home session plus two sessions the agent
// completed on its own this morning (they match the activity feed).

function call(name: string, args: Record<string, unknown>, result: unknown, ms: number): ToolCall {
  return { id: uid("c"), name, args, result, status: "done", start: 0, ms };
}

function done(title: string, at: string, event: string, blocks: Block[], actions: { at: string; text: string; kind: Session["actions"][number]["kind"] }[]): Session {
  const s = newSession(title, true);
  s.createdAt = at;
  s.status = "done";
  s.items = [
    { t: "event", id: uid("e"), text: event, tone: "info", at },
    { t: "agent", id: uid("a"), blocks, at, done: true },
  ];
  s.actions = actions.map(a => ({ id: uid("x"), ...a }));
  return s;
}

let seeded = false;

export function seed() {
  if (seeded) return;
  seeded = true;

  done(
    "Overnight summary",
    "8:02 am",
    "Scheduled run · daily at 8:00 am",
    [
      { t: "think", id: uid(), v: 0, text: "Check the gate log, climate sensors, payments and calls since 10:00 pm. Flag only what needs Priya.", start: 0, ms: 1400 },
      {
        t: "tools",
        id: uid(),
        v: 0,
        calls: [
          call("gate.log", { since: "22:00", until: "06:00" }, { entries: 0, after_hours_attempts: 0 }, 640),
          call("sensors.climate", { building: "D" }, { min_f: 62, max_f: 64, humidity: "41–44%" }, 520),
          call("payments.autopay_run", { date: "2026-10-02" }, { attempted: 38, succeeded: 34, failed: 4, total_failed: 832 }, 910),
          call("calls.overnight", {}, { answered_by_voice: 3, bookings: 1 }, 480),
        ],
      },
      {
        t: "say",
        id: uid(),
        v: 0,
        shown: 9999,
        done: true,
        text: "Quiet night. No after-hours gate attempts, and Building D held **62–64°F**.\n- 34 of 38 autopay charges went through. **4 failed** ($832.00): two expired cards, one insufficient funds, one bank decline.\n- Zonera Voice answered 3 calls overnight and booked a 10×20 for Owen Murphy.\nI'll put the autopay failures in your morning briefing.",
      },
      {
        t: "widget",
        id: uid("w"),
        v: 0,
        w: "answer",
        status: "display",
        props: {
          tiles: [
            { label: "Gate events", value: "0", context: "10 pm – 6 am" },
            { label: "Building D", value: "62–64°F", context: "in range" },
            { label: "Autopay", value: "34 / 38", delta: { text: "4 failed", tone: "warn" } },
            { label: "Calls", value: "3", context: "1 booking" },
          ],
        },
      },
    ],
    [{ at: "8:02", kind: "agent", text: "Overnight: no after-hours gate attempts. Climate in Building D held 62–64°F" }],
  );

  done(
    "Gate 2 exit sensor",
    "8:52 am",
    "Alert · Gate 2 exit sensor reported offline",
    [
      { t: "think", id: uid(), v: 0, text: "Exit sensor down means the gate won't open on approach. Keep exits working first, then get it fixed.", start: 0, ms: 1100 },
      {
        t: "tools",
        id: uid(),
        v: 0,
        calls: [
          call("gate.devices.status", { gate: "gate-2" }, { exit_loop: "offline", keypad: "online", last_seen: "8:51 am" }, 560),
          call("gate.config.update", { gate: "gate-2", exit_mode: "keypad_fallback" }, { status: "applied" }, 700),
          call("vendors.search", { trade: "gate access" }, [{ name: "Tahoe Access Systems", sla: "same day", contract: true }], 480),
          call("workorders.create", { asset: "gate-2-exit-loop", vendor: "Tahoe Access Systems", priority: "high" }, { id: "WO-2291", window: "Today 2:00 – 4:00 pm" }, 820),
        ],
      },
      {
        t: "say",
        id: uid(),
        v: 0,
        shown: 9999,
        done: true,
        text: "Gate 2's exit loop went offline at 8:51 am. I switched exits to **keypad fallback** so nobody gets stuck, and opened **WO-2291** with Tahoe Access Systems under the service contract. They'll be here **2:00 – 4:00 pm** today.",
      },
      {
        t: "widget",
        id: uid("w"),
        v: 0,
        w: "answer",
        status: "display",
        props: {
          label: "Work order",
          value: "WO-2291",
          context: "Gate 2 exit loop · Tahoe Access Systems · today 2:00 – 4:00 pm · covered by contract",
          links: [{ label: "Open maintenance", route: "ops/maintenance" }],
        },
      },
    ],
    [
      { at: "8:52", kind: "alert", text: "Gate 2 exits switched to keypad fallback" },
      { at: "8:53", kind: "maintenance", text: "Opened WO-2291 with Tahoe Access Systems, today 2–4 pm" },
    ],
  );

  const home = newSession();
  agent.activeId = home.id;
}
