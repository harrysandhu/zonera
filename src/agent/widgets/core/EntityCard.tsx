import React from "react";
import { Users, ArrowUpRight, UserPlus } from "lucide-react";
import { Avatar, UnitStatusPill } from "../../../ui";
import { go, useDemo } from "../../../state/store";
import { TENANT_BY_ID, LEADS } from "../../../data/tenants";
import { UNIT_BY_ID } from "../../../data/facility";
import { money, RESERVATIONS } from "../../data";
import { defineWidget, Frame, Rows } from "../frame";
import type { EntityProps } from "./types";

// Tenant or lead card. Reads live data, so it updates when effects land.
export const EntityCard = defineWidget<EntityProps, void>(function EntityCard(w) {
  useDemo();
  if (w.p.lead) {
    const l = LEADS.find(x => x.name === w.p.lead);
    if (!l) return null;
    const r = RESERVATIONS[l.name];
    return (
      <Frame icon={<UserPlus />} title={w.p.title ?? "Reservation"} meta={r?.id} state="info">
        <div className="ag-tcard">
          <Avatar name={l.name} />
          <div className="ag-tcard-t">
            <b>{l.name}</b>
            <small>
              {l.size.replace("x", "×")} · {l.source} · <span className="mono">{l.phone}</span>
            </small>
          </div>
        </div>
        <Rows rows={[["Moving", l.moving], ["Held unit", r?.unit ?? "—"], ["Note", l.note]]} />
      </Frame>
    );
  }
  const t = TENANT_BY_ID.get(w.p.tenantId ?? "");
  if (!t) return null;
  const u = UNIT_BY_ID.get(t.unitIds[0]);
  return (
    <Frame icon={<Users />} title={w.p.title ?? "Tenant"} meta={t.id} state="info">
      <div className="ag-tcard">
        <Avatar name={t.name} />
        <div className="ag-tcard-t">
          <b>{t.name}</b>
          <small>
            <span className="mono">{t.unitIds.join(", ")}</span> · {u ? u.size.replace("x", "×") : ""} · <span className="mono">{t.phone}</span>
          </small>
        </div>
        {u && <UnitStatusPill status={u.status} />}
      </div>
      <Rows
        rows={[
          ["Rent", money(t.rent) + "/mo"],
          ["Balance", <span className={t.balance > 0 ? "is-warn" : ""}>{money(t.balance)}</span>],
          ["Days late", t.daysLate ? String(t.daysLate) : "—"],
          ["Autopay", t.autopay ? t.card ?? "On" : "Off"],
        ]}
      />
      <button type="button" className="ag-more" onClick={() => go("ops/tenants/" + t.id)}>
        Open profile <ArrowUpRight />
      </button>
    </Frame>
  );
});
