import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { needTenant } from "../../need";
import { nextCode } from "../../data";
import { addAddendum, leaseFor, logLease } from "../../../data/leases";

// Add an addendum to a signed lease and send it for e-signature.
//
//   "Add an addendum to Sofia Reyes's lease for C-108"   → asks which kind
//   "Add Sofia's partner as an authorized user"          → access addendum

type Kind = "access" | "business" | "vehicle" | "mail";
const KIND: Record<Kind, { title: string; hint: string; terms: string }> = {
  access: { title: "Authorized access", hint: "A second person can enter with their own code", terms: "Daniel Reyes may access the unit with a separate gate code. The occupant stays responsible for rent and contents." },
  business: { title: "Business use", hint: "Inventory and deliveries for a small business", terms: "Business inventory allowed. No retail sales or customers on site. Deliveries accepted at the office 9 am–5 pm." },
  vehicle: { title: "Vehicle storage", hint: "Registered, insured, no fluids leaking", terms: "One registered, insured vehicle. Battery disconnected, no fuel cans, drip pan required." },
  mail: { title: "Package acceptance", hint: "Office signs for deliveries", terms: "The office may sign for packages up to 50 lb and hold them for 7 days." },
};

export default defineSkill<{ who: string; kind: Kind }>({
  id: "frontdesk.addendum",
  category: "frontdesk",
  title: "Lease addendum",
  featured: true,
  examples: ["Add an addendum to Sofia Reyes's lease for C-108", "Add Sofia's partner as an authorized user"],
  slots: {
    who: { label: "tenant", fill: q => q.people.find(p => p.kind === "tenant")?.name ?? q.ambiguous[0]?.said },
    kind: {
      label: "addendum",
      fill: q => (/\bauthori[sz]ed|partner|second person|access\b/.test(q.lower) ? "access" : /\bbusiness|inventory\b/.test(q.lower) ? "business" : /\bvehicle|car|truck\b/.test(q.lower) ? "vehicle" : /\bpackage|mail|deliver/.test(q.lower) ? "mail" : undefined),
      show: v => KIND[v as Kind].title.toLowerCase(),
      options: () => (Object.keys(KIND) as Kind[]).map(k => ({ value: k, label: KIND[k].title })),
    },
  },
  match: q => kw(q, [[/\baddend(um|a)\b|\bauthori[sz]ed (user|person|access)\b/, 6]]),
  async run(ctx, { q, slots }) {
    const t = await needTenant(ctx, q, { prefer: x => (x.last === "Reyes" ? 1 : 0) });
    const l = leaseFor(t);
    ctx.title(`Addendum · ${t.name}`);
    ctx.focus({ tenants: [t.id], selected: l.unitId });
    await ctx.think("Pick the addendum template, fill it from the lease, send it for signature. The base lease doesn't change.", 900);
    await ctx.tool("leases.get", { tenant_id: t.id }, { number: l.number, addenda: l.addenda.length }, 500);
    const kind = (slots.kind ??
      (await ctx.ask(
        "quickReplies",
        { question: `What should the addendum to ${t.first}'s lease cover?`, options: (Object.keys(KIND) as Kind[]).map(k => ({ value: k, label: KIND[k].title, hint: KIND[k].hint })) },
        ["wait:900", "opt:access"],
      ))) as Kind;
    const k = KIND[kind];
    const code = kind === "access" ? nextCode() : undefined;
    const ok = await ctx.ask(
      "diff",
      {
        title: `Addendum · ${k.title}`,
        meta: `${l.number} · ${l.unitId}`,
        rows: [
          { field: "Terms", before: "—", after: k.terms },
          { field: "Effective", before: "—", after: "Today, on signature" },
          { field: "Signers", before: "—", after: `${t.name} · e-sign by SMS and email` },
          ...(code ? [{ field: "Second gate code", before: "—", after: `${code}# · same doors as ${t.first}` }] : []),
          { field: "Fee", before: "—", after: "None" },
        ],
        note: "Rent and the original lease terms stay the same.",
        cta: "Send for signature",
      },
      ["wait:900", "submit"],
    );
    if (ok !== "approve") return;
    let undo = () => {};
    ctx.effect({
      kind: "lease",
      text: `Addendum sent to ${t.name} · ${k.title} · ${l.unitId}`,
      run: () => {
        undo = addAddendum(t.id, { title: k.title, status: "Sent", note: kind === "access" ? `Daniel Reyes · code ${code}#` : k.hint });
        logLease(t.id, { text: `Addendum sent for signature · ${k.title}`, who: "Zonera agent", meta: `SMS ${t.phone}` });
      },
      undo: () => undo(),
      link: { label: "Open lease", route: `ops/leases/${t.id}` },
    });
    const ids = ["pdf", "send", "sign"];
    const prog = ctx.show("progress", {
      title: "Addendum",
      items: [
        { id: "pdf", label: "Generate addendum PDF", state: "run" },
        { id: "send", label: `Send to ${t.first} for e-signature`, state: "todo" },
        { id: "sign", label: "Signed", state: "todo" },
      ],
    });
    const done = async (id: string, result: string, ms: number) => {
      await ctx.wait(ms);
      const next = ids[ids.indexOf(id) + 1];
      prog.update(p => ({ items: p.items.map(i => (i.id === id ? { ...i, state: "done" as const, result } : i.id === next ? { ...i, state: "run" as const } : i)) }));
    };
    await done("pdf", `${l.number}-A${l.addenda.length + 1}.pdf · 1 page`, 700);
    await done("send", `Delivered to ${t.phone}`, 900);
    await done("sign", "Signed on iPhone", 1600);
    prog.update({ summary: "Signed and filed with the lease." });
    await ctx.say(`${t.first} signed the **${k.title.toLowerCase()}** addendum. It's filed with ${l.number}${code ? `, and code ${code}# is live for Daniel` : ""}.`);
    ctx.suggest([`Explain ${t.name}'s lease`, `Pull up ${t.name}`, "Move Sofia Reyes from her 5×10 to a 10×10"].filter((x, i) => i < 2 || t.last === "Reyes"));
  },
});
