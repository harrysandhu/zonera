import React from "react";
import { Check, Users } from "lucide-react";
import { Avatar } from "../../../ui";
import { defineWidget, Frame, stateOf } from "../frame";
import type { DisambiguateAnswer, DisambiguateProps } from "./types";

// W2 · Pick one of several candidates. Single click answers.
// Movie mode: "opt:<candidate id>".
export const Disambiguate = defineWidget<DisambiguateProps, DisambiguateAnswer>(function Disambiguate(w) {
  const { p, active, answer } = w;
  const chosen = p.options.find(o => o.id === answer);
  return (
    <Frame icon={<Users />} title={p.title} meta={p.meta} {...stateOf(w, chosen ? `${chosen.title}${chosen.sub ? " · " + chosen.sub.split(" · ")[0] : ""}` : undefined)} flush>
      <div className="ag-opts" role="listbox">
        {p.options.map(o => (
          <button
            key={o.id}
            type="button"
            role="option"
            aria-selected={answer === o.id}
            data-auto={"opt:" + o.id}
            className={`ag-opt ${answer === o.id ? "is-on" : ""}`}
            disabled={!active}
            onClick={() => w.respond(o.id)}
          >
            {o.avatar && <Avatar name={o.avatar} size="sm" />}
            <span className="ag-opt-t">
              <b>
                {o.title}
                {o.badge && <span className="ag-badge">{o.badge}</span>}
              </b>
              {o.sub && <small>{o.sub}</small>}
            </span>
            {o.meta && <span className={`ag-opt-m ${o.metaTone ? "is-" + o.metaTone : ""}`}>{o.meta}</span>}
            {answer === o.id ? <Check className="ag-opt-check" /> : <span className="ag-opt-radio" />}
          </button>
        ))}
      </div>
    </Frame>
  );
});
