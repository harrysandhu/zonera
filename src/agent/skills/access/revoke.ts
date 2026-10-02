import { defineSkill } from "../../engine";
import { kw, type Parsed } from "../../parse";
import { ACCESS_CODES, GATE_EVENTS, pushGateEvent, type AccessCode } from "../../../data/gate";
import { clock } from "../../../state/store";
import { fmtTime } from "./ops";

// Revoke vendor / staff codes now or at a set time. Reads the stored codes in
// src/data/gate.ts (including the one the "New gate code" skill creates) and
// edits them in place so Gate access follows; undo restores each code.
//
//   "Revoke the HVAC tech's code at 5pm"   → hard stop at 5:00 pm, heads-up text at 4:45
//   "Turn off all vendor codes now"        → every live vendor code expires now

type Target = "hvac" | "vendors" | string;

const HOLDERS: [RegExp, Target][] = [
  [/\b(all|every|each)\b.{0,12}\b(vendor|contractor|temporary|temp|guest)s?\b.{0,8}\bcodes?\b|\ball (the )?vendor\b|\bvendor codes\b/, "vendors"],
  [/\b(hvac|heating|air ?con|lakeside)\b/, "hvac"],
  [/\b(gate|tahoe|sensor)\b.{0,10}\b(tech|guy|vendor)\b|\bkim\b/, "tahoe"],
  [/\b(pest|sierra|exterminator|anna)\b/, "pest"],
  [/\b(clean(ers|ing)?|shoreline|janitor)\b/, "clean"],
];

function targetOf(q: Parsed): Target | undefined {
  for (const [re, t] of HOLDERS) if (re.test(q.lower)) return t;
  return undefined;
}

function codesFor(t: Target): AccessCode[] {
  const live = ACCESS_CODES.filter(c => c.status !== "expired" && c.status !== "suspended");
  const byWord: Record<string, (c: AccessCode) => boolean> = {
    vendors: c => c.type === "vendor",
    hvac: c => c.type === "vendor" && (/hvac/i.test(`${c.holder} ${c.note ?? ""}`) || c.company === "Lakeside Mechanical"),
    tahoe: c => c.type === "vendor" && /tahoe/i.test(c.company ?? ""),
    pest: c => c.type === "vendor" && /pest/i.test(c.company ?? ""),
    clean: c => /clean/i.test(`${c.holder} ${c.company ?? ""}`),
  };
  return live.filter(byWord[t] ?? (() => false));
}

const LABEL: Record<string, string> = { vendors: "all vendor codes", hvac: "HVAC tech", tahoe: "gate tech", pest: "pest control", clean: "cleaners" };

/** "Today · 1:00–5:00 pm" → "17:00" */
function windowEnd(w: string) {
  const m = /–(\d{1,2})(?::(\d{2}))?\s*(am|pm)/.exec(w);
  if (!m) return undefined;
  return `${String((+m[1] % 12) + (m[3] === "pm" ? 12 : 0)).padStart(2, "0")}:${m[2] ?? "00"}`;
}

function nowHHMM() {
  const m = /(\d+):(\d+)\s*(am|pm)/.exec(clock());
  if (!m) return "09:45";
  return `${String((+m[1] % 12) + (m[3] === "pm" ? 12 : 0)).padStart(2, "0")}:${m[2]}`;
}

/** Change the end of a "Today · 1:00–5:00 pm" window. */
function withEnd(w: string, to: string) {
  return w.replace(/–\d{1,2}(:\d{2})?\s*(am|pm)/, "–" + fmtTime(to)).replace(/(\d{1,2}:\d{2}) (am|pm)–(\d{1,2}:\d{2}) \2/, "$1–$3 $2");
}

export default defineSkill<{ who: Target; when: string }>({
  id: "access.revoke",
  category: "access",
  title: "Revoke a code",
  featured: true,
  examples: ["Revoke the HVAC tech's code at 5pm", "Turn off all vendor codes now"],
  slots: {
    who: { label: "codes", fill: q => targetOf(q), default: "hvac", show: v => LABEL[v] ?? v },
    when: {
      label: "when",
      fill: q => (/\b(now|right now|immediately|right away|asap)\b/.test(q.lower) ? "now" : q.time ?? q.window?.to),
      default: "now",
      show: v => (v === "now" ? "now" : `at ${fmtTime(v)} sharp`),
      options: () => [
        { value: "now", label: "Now" },
        { value: "17:00", label: "At 5:00 pm" },
      ],
    },
  },
  match: q =>
    kw(q, [
      [/\b(revoke|deactivate|disable|cancel|kill|cut off|shut off|turn off|expire)\b.{0,40}\b(codes?|access)\b|\brevoke\b/, 5],
      [/\bcodes?\b/, 1],
      [/\b(make|create|give|new|generate)\b/, -3],
    ]),

  async run(ctx, { slots }) {
    const who = slots.who ?? "hvac";
    const at = slots.when ?? "now";
    const now = at === "now";
    ctx.title(`Revoke · ${LABEL[who] ?? who}`);
    await ctx.think(now ? "Find every live code that matches, expire them at all keypads now, and tell anyone who's mid-visit." : `Find the code, set a hard stop at ${fmtTime(at)} with no exit grace, and text the holder a heads-up first.`, 1000);

    const codes = codesFor(who);
    await ctx.tool("gate.codes.list", { type: who === "vendors" ? "vendor" : undefined, holder: who === "vendors" ? undefined : LABEL[who], status: ["active", "scheduled"] }, () => ({ count: codes.length, codes: codes.map(c => ({ id: c.id, holder: c.holder, code: c.code, window: c.window, status: c.status })) }), 620);

    if (!codes.length) {
      await ctx.say(`No live ${who === "vendors" ? "vendor codes" : `codes for the ${LABEL[who] ?? who}`} right now. Everything matching has already expired.`);
      ctx.suggest(["Make a gate code for the HVAC tech, 1–5pm today, Building D only", "Who came in after 10pm last night?"]);
      return;
    }

    // What changes per code.
    const plan = codes.map(c => {
      const end = windowEnd(c.window);
      const today = c.window.startsWith("Today");
      const already = !now && today && end === at;
      return { c, end, today, already, after: now ? "Revoked now" : today ? (already ? `Ends ${fmtTime(at)} sharp · no exit grace` : `Ends ${fmtTime(at)} sharp`) : `Revoked at ${fmtTime(at)} today` };
    });
    const single = plan.length === 1 ? plan[0] : undefined;
    const kim = codes.find(c => /tahoe/i.test(c.company ?? ""));

    if (single) {
      const c = single.c;
      await ctx.say(
        now
          ? `**${c.code}#** for ${c.holder} (${c.company}) is ${c.status}, ${c.window.toLowerCase()}. Revoking it now removes it from every keypad.`
          : single.already
            ? `**${c.code}#** for ${c.holder} (${c.company}) already ends at ${fmtTime(at)}, but keypads allow 30 minutes to exit. I'll make it a hard stop and text ${c.holder.split(" ")[0]} at ${fmtTime(hhmmMinus(at, 15))}.`
            : `**${c.code}#** for ${c.holder} (${c.company}) runs ${c.window.replace("Today · ", "today ")}. I'll cut it off at ${fmtTime(at)} instead.`,
      );
    } else {
      await ctx.say(`${codes.length} live vendor codes. ${now ? "Revoking them now removes them from every keypad." : `All of them stop at ${fmtTime(at)}.`}${kim ? ` ${kim.holder} is booked for the Gate 2 sensor (WO-2050) this afternoon and will need a new code.` : ""}`);
    }

    const rows = single
      ? [
          { field: "Window", before: single.c.window.replace("Today · ", "Today "), after: now ? `Ended ${fmtTime(nowHHMM())}` : withEnd(single.c.window, at).replace("Today · ", "Today ") + (single.already ? " sharp" : "") },
          { field: "Exit grace", before: "30 min", after: "None" },
          { field: "Status", before: single.c.status, after: now ? "revoked" : `revokes at ${fmtTime(at)}` },
          { field: "Heads-up", before: "—", after: single.c.phone ? `SMS to ${single.c.holder.split(" ")[0]} · ${now ? "now" : fmtTime(hhmmMinus(at, 15))}` : "—" },
        ]
      : plan.map(p => ({ field: `${p.c.code}# · ${p.c.holder}`, before: `${p.c.status} · ${p.c.window.replace("Today · ", "today ")}`, after: p.after }));

    const ans = await ctx.ask(
      "diff",
      {
        title: single ? `Revoke ${single.c.code}# · ${single.c.holder}` : `Revoke ${codes.length} vendor codes`,
        meta: single ? single.c.company : now ? "now" : `at ${fmtTime(at)}`,
        rows,
        note: now ? "Takes effect at every keypad within a few seconds. Holders get a text." : "Every use until then shows up in Gate access.",
        cta: now ? `Revoke ${codes.length === 1 ? "code" : codes.length + " codes"} now` : `Schedule revoke for ${fmtTime(at)}`,
      },
      ["wait:900", "submit"],
    );
    if (ans !== "approve") {
      await ctx.say("Left as is. Nothing changed.");
      return;
    }

    const prev = codes.map(c => ({ c, status: c.status, window: c.window, note: c.note }));
    let evs: ReturnType<typeof pushGateEvent>[] = [];
    const id = ctx.effect({
      kind: "gate",
      text: now ? `Revoked ${codes.length === 1 ? `${codes[0].code}# for ${codes[0].holder}` : `${codes.length} vendor codes`}` : `${codes.length === 1 ? `${codes[0].code}# for ${codes[0].holder}` : `${codes.length} vendor codes`} revoke at ${fmtTime(at)} sharp`,
      run: () => {
        for (const c of codes) {
          if (now) {
            c.status = "expired";
            c.note = `Revoked ${clock()} by Priya Raman`;
          } else {
            if (c.window.startsWith("Today")) c.window = withEnd(c.window, at);
            c.note = `${c.note ? c.note + " · " : ""}Hard stop ${fmtTime(at)}, no exit grace`;
          }
        }
        if (now) evs = codes.map(c => pushGateEvent({ at: clock(), gate: "G1", kind: "system", who: "Zonera agent", note: `Code ${c.code} revoked · ${c.holder}`, fresh: true }));
      },
      undo: () => {
        for (const p of prev) Object.assign(p.c, { status: p.status, window: p.window, note: p.note });
        for (const e of evs) {
          const i = GATE_EVENTS.indexOf(e);
          if (i >= 0) GATE_EVENTS.splice(i, 1);
        }
      },
      link: { label: "Open Gate access", route: "ops/gate" },
    });
    void id;
    const withPhone = codes.filter(c => c.phone);
    if (withPhone.length) await ctx.tool("sms.send_batch", { to: withPhone.map(c => c.phone), template: now ? "code_revoked" : "code_ends_soon", send_at: now ? "now" : hhmmMinus(at, 15) }, { queued: withPhone.length, status: now ? "delivered" : "scheduled" }, 600);

    ctx.show("answer", {
      label: now ? "Revoked" : `Revokes at ${fmtTime(at)}`,
      value: codes.length === 1 ? `${codes[0].code}#` : `${codes.length} codes`,
      context: now
        ? `${codes.map(c => c.holder).join(", ")} · removed from every keypad · ${withPhone.length} texted`
        : `${codes.map(c => c.holder).join(", ")} · hard stop, no exit grace · heads-up text at ${fmtTime(hhmmMinus(at, 15))}`,
      items: codes.map(c => ({ label: `${c.code}# · ${c.holder} · ${c.company ?? c.type}`, meta: now ? "expired" : `ends ${fmtTime(at)}` })),
      links: [{ label: "Open Gate access", route: "ops/gate" }],
    });
    await ctx.say(now ? `Done. ${codes.length === 1 ? "The code no longer opens anything" : "None of them open anything now"}. Undo is in Actions taken if someone still needs in.` : `Set. The code works until ${fmtTime(at)} and not a minute after.`);
    ctx.suggest(kim && now ? ["Make a gate code for the HVAC tech, 1–5pm today, Building D only", "Who came in after 10pm last night?"] : ["Who came in after 10pm last night?", "Give the cleaners gate access 6–8am tomorrow"]);
  },
});

function hhmmMinus(hhmm: string, min: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m - min;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
