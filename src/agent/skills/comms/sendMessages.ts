import { defineSkill } from "../../engine";
import { kw, type Parsed } from "../../parse";
import { needRecipients } from "../../need";
import { TENANTS } from "../../../data/tenants";
import type { MsgTone, Recipient } from "../../widgets/core/types";

// #55 Send SMS to people (and #54 Send emails, via the channel slot).
// Reference skill for a parametric flow: one skill, many permutations.
//
//   channel   sms | email                      ("text", "SMS", "email")
//   audience  named people | a segment          ("Owen, Hana and Imani", "everyone past due", "10×20 tenants")
//   template  reminder | code | promo | notice | welcome | followup | custom
//   timing    now | tomorrow 9:00 am
//
//   "Text everyone past due a reminder"
//   "Text these 4 people their gate codes: Matthew Cho, Sofia Reyes, Ben Carter, Grace Lindqvist"
//   "Email Owen, Hana, Imani and Rafael about move-in times"
//   "Send a promo email to 10×20 tenants tomorrow"

type Template = "reminder" | "code" | "promo" | "notice" | "welcome" | "followup" | "custom";

const TEMPLATE_LABEL: Record<Template, string> = { reminder: "rent reminder", code: "gate code", promo: "promotion", notice: "notice", welcome: "welcome", followup: "follow-up", custom: "custom message" };

function templateOf(q: Parsed): Template | undefined {
  if (/\bgate codes?\b|\btheir codes?\b/.test(q.lower)) return "code";
  return q.template as Template | undefined;
}

function audienceLabel(q: Parsed) {
  const n = q.people.length + q.ambiguous.length;
  if (q.segment) return `${q.segment.label} · ${q.segment.resolve().length}`;
  if (n) return n === 1 ? (q.people[0]?.name ?? q.ambiguous[0].said) : `${n} people`;
  return undefined;
}

function templates(t: Template, channel: "sms" | "email", purpose?: string): { subject: string; byTone: Partial<Record<MsgTone, string>>; fields: string[] } {
  const sign = channel === "email" ? "\n\nPriya Raman\nZonera Alder Lake · (530) 555-0142" : "";
  switch (t) {
    case "reminder":
      return {
        subject: "Your balance at Zonera Alder Lake",
        fields: ["first", "unit", "balance", "due_date", "link"],
        byTone: {
          friendly: `Hi {first}, a friendly reminder from Zonera Alder Lake: {balance} is due on {unit} (since {due_date}). You can pay in one tap here: {link}${sign}`,
          firm: `{first}, your balance of {balance} on {unit} is past due since {due_date}. Please pay today to keep gate access: {link}${sign}`,
          brief: `Zonera: {balance} due on {unit}. Pay: {link}${sign}`,
        },
      };
    case "code":
      return {
        subject: "Your gate code",
        fields: ["first", "unit", "code"],
        byTone: {
          friendly: `Hi {first}, your gate code at Zonera Alder Lake is {code}. Gate hours are 6:00 am to 10:00 pm. Your unit is {unit}.${sign}`,
          brief: `Zonera gate code: {code}. Gate 6am–10pm. Unit {unit}.${sign}`,
        },
      };
    case "promo":
      return {
        subject: "$1 first month on 10×20 units",
        fields: ["first", "unit"],
        byTone: {
          friendly: `Hi {first}, need more room? 10×20 drive-up units at Alder Lake are $1 for the first month while they last. Reply YES and I'll hold one for you.${sign}`,
          brief: `Zonera: 10×20s are $1 for the first month. Reply YES to hold one.${sign}`,
        },
      };
    case "notice":
      return {
        subject: purpose ? purpose.charAt(0).toUpperCase() + purpose.slice(1) : "A notice from Zonera Alder Lake",
        fields: ["first", "unit"],
        byTone: {
          friendly: `Hi {first}, a quick heads-up from Zonera Alder Lake: ${purpose ?? "the gate will be closed Saturday 8–10 am for maintenance"}. Thanks for your patience.${sign}`,
          brief: `Zonera notice: ${purpose ?? "gate closed Sat 8–10 am"}.${sign}`,
        },
      };
    case "welcome":
      return { subject: "Welcome to Zonera Alder Lake", fields: ["first", "unit", "code"], byTone: { friendly: `Welcome, {first}. {unit} is ready and your gate code is {code}. Reply here any time if you need anything.${sign}` } };
    case "followup":
      return {
        subject: "Your reservation at Zonera Alder Lake",
        fields: ["first", "size", "moving"],
        byTone: {
          friendly: `Hi {first}, it's Priya at Zonera Alder Lake. Your {size} is held for you. Want me to send the lease now so move-in day is just the gate code?${sign}`,
          brief: `Zonera: your {size} is held. Reply YES for the lease.${sign}`,
        },
      };
    default:
      return {
        subject: purpose ? purpose.charAt(0).toUpperCase() + purpose.slice(1) : "A note from Zonera Alder Lake",
        fields: ["first", "unit"],
        byTone: {
          friendly: `Hi {first}, it's Priya at Zonera Alder Lake${purpose ? ` about ${purpose}` : ""}. ${purpose ? "Let me know what works for you." : ""}${sign}`.replace(" .", "."),
          brief: `Zonera${purpose ? `: ${purpose}` : ""}.${sign}`,
        },
      };
  }
}

export default defineSkill<{ channel: "sms" | "email"; audience: string; template: Template; timing: "now" | "tomorrow" }>({
  id: "comms.send",
  n: 55,
  category: "comms",
  title: "Send messages",
  featured: true,
  examples: [
    "Text everyone past due a reminder",
    "Text these 4 people their gate codes: Matthew Cho, Sofia Reyes, Ben Carter, Grace Lindqvist",
    "Email Owen, Hana, Imani and Rafael about move-in times",
    "Send a promo email to 10×20 tenants tomorrow",
  ],
  slots: {
    channel: {
      label: "channel",
      fill: q => (q.channel === "email" || q.channel === "sms" ? q.channel : undefined),
      default: "sms",
      show: v => (v === "sms" ? "sms" : "email"),
      options: () => [
        { value: "sms", label: "SMS" },
        { value: "email", label: "Email" },
      ],
    },
    audience: { label: "to", fill: audienceLabel },
    template: {
      label: "message",
      fill: templateOf,
      default: "custom",
      show: v => TEMPLATE_LABEL[v],
      options: () => (Object.keys(TEMPLATE_LABEL) as Template[]).map(k => ({ value: k, label: TEMPLATE_LABEL[k] })),
    },
    timing: {
      label: "when",
      fill: q => (q.dates.includes("2026-10-03") || /tomorrow/.test(q.lower) ? "tomorrow" : undefined),
      default: "now",
      show: v => (v === "now" ? "send now" : "9:00 am tomorrow"),
      options: () => [
        { value: "now", label: "Send now" },
        { value: "tomorrow", label: "9:00 am tomorrow" },
      ],
    },
  },
  match: q =>
    kw(q, [
      [/\b(text|sms|message|email|e-mail)\b/, 3],
      [/\b(send|tell|notify|let .* know|announce)\b/, 1],
      [/\bfollow ?up with\b/, 3],
      [/\b(call|phone)\b/, -2],
      [/\breport\b/, -3],
    ]) + (q.people.length || q.segment ? 1 : 0),

  async run(ctx, { q, slots }) {
    const channel = slots.channel ?? "sms";
    const template = slots.template ?? "custom";
    const noun = channel === "sms" ? "texts" : "emails";
    await ctx.think(
      `${channel === "sms" ? "SMS" : "Email"}, ${TEMPLATE_LABEL[template]}${q.segment ? `, to ${q.segment.noun}` : ""}. Resolve who exactly, check each person can be reached on this channel, then draft with merge fields.`,
      1100,
    );

    // 1 · Who.
    await ctx.tool(
      q.segment ? "segments.resolve" : "contacts.lookup",
      q.segment ? { segment: q.segment.id } : { names: [...q.people.map(p => p.name), ...q.ambiguous.map(a => a.said)] },
      () => {
        const n = q.segment ? q.segment.resolve().length : q.people.length + q.ambiguous.length;
        return { matches: n, channel, opted_out: 0 };
      },
      560,
    );
    const people: Recipient[] = await needRecipients(ctx, q, channel);
    ctx.focus({ tenants: people.filter(p => p.id.startsWith("T-")).slice(0, 4).map(p => p.id), leads: people.filter(p => !p.id.startsWith("T-")).map(p => p.id), units: people.map(p => p.data?.unit ?? "").filter(Boolean).flatMap(u => u.split(", ")) });

    const missing = people.filter(p => (channel === "email" ? !p.email : !p.phone));
    const t = templates(template, channel, q.purpose);
    await ctx.say(
      `${people.length} ${people.length === 1 ? "person" : "people"}${q.segment ? ` (${q.segment.noun})` : ""}. ` +
        (template === "reminder" ? `Balances range from ${minMax(people)}. ` : "") +
        (missing.length ? `${missing.length} can't be reached by ${channel === "sms" ? "text" : "email"}; I'll use the other channel for them. ` : "") +
        "Here's the draft. Each message fills in their own details.",
    );

    // 2 · Compose.
    const sent = await ctx.ask(
      "bulkMessage",
      {
        channel,
        recipients: people,
        subject: t.subject,
        templates: t.byTone,
        tone: template === "reminder" && q.segment?.id.startsWith("late-") ? "firm" : "friendly",
        fields: t.fields,
        schedule: slots.timing === "tomorrow" ? "tomorrow" : "now",
      },
      ["next", "wait:500", "submit"],
    );

    // 3 · Send and track.
    const ch = sent.channel;
    await ctx.tool(ch === "sms" ? "sms.send_batch" : "email.send_batch", { count: sent.messages.length, template, tone: sent.tone, schedule: sent.schedule }, () => ({ queued: sent.messages.length, batch: "B-" + (2200 + sent.messages.length) }), 700);
    if (sent.schedule !== "now") {
      ctx.effect({ kind: "agent", text: `Scheduled ${sent.messages.length} ${ch === "sms" ? "texts" : "emails"} (${TEMPLATE_LABEL[template]}) for 9:00 am tomorrow` });
      await ctx.say(`Scheduled for 9:00 am tomorrow. You can cancel it from the actions list until then.`);
      ctx.suggest(["Who's more than 15 days late?", "Show delinquency aging"]);
      return;
    }
    const rows = sent.messages.map(m => ({ id: m.id, name: m.name, to: m.to, state: "queued" as const }));
    const track = ctx.show("delivery", { channel: ch, title: `${sent.messages.length} ${ch === "sms" ? "texts" : "emails"}`, rows });
    const order = ["sent", "delivered", "read"] as const;
    for (const stage of order) {
      for (let i = 0; i < rows.length; i++) {
        await ctx.wait(stage === "sent" ? 140 : 110);
        if (stage === "read" && i % 3 === 2) continue;
        track.update(p => ({ rows: p.rows.map((r, j) => (j === i ? { ...r, state: stage, at: stage === "sent" ? undefined : r.at } : r)) }));
      }
      await ctx.wait(350);
    }
    // A reply comes back on reminders and follow-ups.
    if ((template === "reminder" || template === "followup" || template === "custom") && rows.length > 1) {
      await ctx.wait(900);
      const first = sent.messages[0];
      const reply = template === "reminder" ? "Paying now, sorry about that" : template === "followup" ? "Yes please send it over" : "Thanks, sounds good";
      track.update(p => ({ rows: p.rows.map((r, j) => (j === 0 ? { ...r, state: "replied", reply } : r)) }));
    }

    ctx.effect({
      kind: ch === "sms" ? "agent" : "agent",
      text: `Sent ${sent.messages.length} ${ch === "sms" ? "texts" : "emails"} · ${TEMPLATE_LABEL[template]}`,
      run: () => {
        for (const m of sent.messages) {
          const tn = TENANTS.find(x => x.id === m.id);
          if (tn) tn.lastContact = `Oct 2 · ${ch === "sms" ? "SMS" : "Email"} ${TEMPLATE_LABEL[template]}`;
        }
      },
    });
    await ctx.say(`All ${sent.messages.length} ${noun} delivered. I'll post replies here as they come in${template === "reminder" ? " and match payments to the balances automatically" : ""}.`);
    ctx.suggest(template === "reminder" ? ["Who's more than 15 days late?", "Show delinquency aging", "Start the lien process for Dana Whitfield"] : ["Show today's move-ins", "Call Leila Haddad and finish her reservation", "Follow up with this week's reservations"]);
  },
});

function minMax(people: Recipient[]) {
  const vals = people.map(p => Number((p.data?.balance ?? "$0").replace(/[$,]/g, ""))).filter(v => v > 0);
  if (!vals.length) return "$0";
  const f = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${f(Math.min(...vals))} to ${f(Math.max(...vals))}`;
}
