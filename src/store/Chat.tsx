import React, { useEffect, useRef, useState } from "react";
import { ArrowUp, MessageCircle, X } from "lucide-react";
import { FACILITY, availableUnits } from "../data/facility";
import { useDemo } from "../state/store";
import { Mark } from "../ui";

// A small renter-facing assistant with canned answers. Pulls live availability.

interface Msg {
  id: number;
  who: "me" | "bot";
  text: string;
  action?: { label: string; run: () => void };
}

interface Canned {
  q: string;
  keys: RegExp;
  a: () => string;
  action?: string;
}

const CANNED: Canned[] = [
  {
    q: "What size fits a one-bedroom?",
    keys: /size|one.?bed|1.?bed|apartment|fit|how (big|much space)/,
    a: () => `Most one-bedrooms fit in a 10×10 with an aisle to the back. You'd fill a little over half of it. ${availableUnits("10x10").length} are free today, from $189 a month.`,
    action: "Show me 10×10s",
  },
  {
    q: "Can I move in today?",
    keys: /today|now|tonight|same day|move in|asap/,
    a: () => `Yes. Rent online and your gate code arrives by text as soon as you sign. The gate is open until 10:00 pm tonight, so you have time for a first load.`,
  },
  {
    q: "Do you have climate control?",
    keys: /climate|temperature|heat|cold|humid|indoor/,
    a: () => `Yes, Building D is climate controlled and kept between 55 and 80°F, with an elevator to the second floor. ${availableUnits().filter(u => u.kind === "climate").length} units are free, from $79 a month.`,
  },
  {
    q: "How does protection work?",
    keys: /insur|protect|cover|damage|theft/,
    a: () => `Pick a plan at checkout: $2,000 of coverage for $12 a month, $5,000 for $19 or $10,000 for $29. If your homeowners or renters policy already covers storage, upload it instead and skip the plan.`,
  },
  {
    q: "Can I cancel any time?",
    keys: /cancel|contract|lease|commit|month.to.month|leave|notice/,
    a: () => `Yes. It's month to month. Give 10 days' notice from your account and billing stops at the end of the month you've paid for.`,
  },
];

export function Chat({ onShowSize }: { onShowSize: () => void }) {
  useDemo();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, who: "bot", text: "Hi. I can help with sizes, prices, access hours and anything about renting here." }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const seq = useRef(1);
  const asked = new Set(msgs.filter(m => m.who === "me").map(m => m.text));

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    setText("");
    setMsgs(m => [...m, { id: seq.current++, who: "me", text: q.trim() }]);
    setBusy(true);
    const hit = CANNED.find(c => c.q === q) ?? CANNED.find(c => c.keys.test(q.toLowerCase()));
    const answer = hit ? hit.a() : `I don't have an answer for that yet. The office can help: ${FACILITY.phone}, ${FACILITY.officeHours.replace(", ", " ")}.`;
    await new Promise(r => setTimeout(r, 650));
    const id = seq.current++;
    setMsgs(m => [...m, { id, who: "bot", text: "" }]);
    setBusy(false);
    for (let i = 1; i <= answer.length; i += 3) {
      const t = answer.slice(0, i);
      setMsgs(m => m.map(x => (x.id === id ? { ...x, text: t } : x)));
      await new Promise(r => setTimeout(r, 16));
    }
    setMsgs(m =>
      m.map(x =>
        x.id === id
          ? {
              ...x,
              text: answer,
              action: hit?.action
                ? {
                    label: hit.action,
                    run: () => {
                      setOpen(false);
                      onShowSize();
                    },
                  }
                : undefined,
            }
          : x,
      ),
    );
  };

  return (
    <div className={`st-chat ${open ? "open" : ""}`}>
      {open && (
        <div className="st-chat-panel" role="dialog" aria-label="Ask a question">
          <header>
            <Mark size={22} />
            <div>
              <b>Alder Lake assistant</b>
              <span>
                <i /> Answers in seconds · office {FACILITY.phone}
              </span>
            </div>
            <button aria-label="Close" onClick={() => setOpen(false)}>
              <X />
            </button>
          </header>
          <div className="st-chat-list" ref={list}>
            {msgs.map(m => (
              <div key={m.id} className={`st-msg st-msg--${m.who}`}>
                <p>{m.text}</p>
                {m.action && (
                  <button className="st-msg-act" onClick={m.action.run}>
                    {m.action.label}
                  </button>
                )}
              </div>
            ))}
            {busy && (
              <div className="st-msg st-msg--bot">
                <p className="st-typing">
                  <i />
                  <i />
                  <i />
                </p>
              </div>
            )}
          </div>
          <div className="st-chat-sugg">
            {CANNED.filter(c => !asked.has(c.q)).map(c => (
              <button key={c.q} onClick={() => ask(c.q)}>
                {c.q}
              </button>
            ))}
          </div>
          <form
            className="st-chat-in"
            onSubmit={e => {
              e.preventDefault();
              ask(text);
            }}
          >
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Ask about sizes, hours, prices…" aria-label="Your question" />
            <button type="submit" aria-label="Send" disabled={!text.trim()}>
              <ArrowUp />
            </button>
          </form>
        </div>
      )}
      <button className="st-chat-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {open ? <X /> : <MessageCircle />}
        <span>{open ? "Close" : "Questions? Ask us"}</span>
      </button>
    </div>
  );
}
