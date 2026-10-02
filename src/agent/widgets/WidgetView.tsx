import React from "react";
import { respond, type Session, type WidgetBlock } from "../engine";
import { widgetFor } from "./registry";

/** Render a widget block from the registry. */
export function WidgetView({ b, s }: { b: WidgetBlock; s: Session }) {
  const def = widgetFor(b.w);
  if (!def) return <div className="ag-w ag-w--info ag-w-missing">Unknown widget “{b.w}”</div>;
  const C = def.C;
  const active = b.status === "active";
  const locked = b.status === "answered" || b.status === "skipped";
  return (
    <div className="ag-wwrap" data-block={b.id} data-widget={b.w}>
      <C b={b} p={b.props} active={active} locked={locked} answer={b.answer} respond={(a: any) => respond(b.id, a)} s={s} />
    </div>
  );
}
