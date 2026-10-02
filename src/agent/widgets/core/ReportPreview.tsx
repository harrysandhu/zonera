import React, { useState } from "react";
import { FileText, Send, Download, CalendarClock, Maximize2, X } from "lucide-react";
import { Button, Modal } from "../../../ui";
import { defineWidget, Frame, stateOf } from "../frame";
import { ChartView } from "./chart";
import type { ReportPreviewAnswer, ReportPreviewProps } from "./types";

function Page({ p, big }: { p: ReportPreviewProps; big?: boolean }) {
  return (
    <div className={`ag-page ${big ? "ag-page--big" : ""}`}>
      <div className="ag-page-h">
        <div>
          <span className="ag-page-brand">zonera</span>
          <b>{p.title}</b>
          {p.subtitle && <small>{p.subtitle}</small>}
        </div>
        <span className="mono">Page 1 of {p.pages}</span>
      </div>
      <div className="ag-page-k">
        {p.kpis.map(k => (
          <div key={k.label}>
            <span>{k.label}</span>
            <b className="tnum">{k.value}</b>
            {k.delta && <em className={`is-${k.tone ?? "neutral"}`}>{k.delta}</em>}
          </div>
        ))}
      </div>
      <div className="ag-page-c">
        {p.charts.slice(0, big ? 3 : 2).map((c, i) => (
          <div key={i}>
            {c.title && <span className="ag-lbl">{c.title}</span>}
            <ChartView spec={c} height={big ? 190 : 120} />
          </div>
        ))}
      </div>
      <div className="ag-page-n">
        {p.narrative.slice(0, big ? 6 : 2).map((n, i) => (
          <p key={i}>{n}</p>
        ))}
      </div>
    </div>
  );
}

// W9 · Mini document with KPIs, charts and narrative; Send / Download / Schedule.
// Movie mode: "send", "download" or "schedule".
export const ReportPreview = defineWidget<ReportPreviewProps, ReportPreviewAnswer>(function ReportPreview(w) {
  const { p, active, answer } = w;
  const [open, setOpen] = useState(false);
  const acts = p.actions ?? ["download", "schedule", "send"];
  const label = { send: "Sent to owners", download: "Downloaded", schedule: "Scheduled monthly" } as const;
  return (
    <Frame
      icon={<FileText />}
      title={p.title}
      meta={`${p.file} · ${p.pages} pages`}
      {...stateOf(w, answer ? label[answer] : undefined)}
      keepOpen
      foot={
        <>
          {p.recipients && <span className="ag-foot-hint">{p.recipients}</span>}
          {acts.includes("download") && (
            <Button data-auto="download" disabled={!active} onClick={() => w.respond("download")}>
              <Download /> Download
            </Button>
          )}
          {acts.includes("schedule") && (
            <Button data-auto="schedule" disabled={!active} onClick={() => w.respond("schedule")}>
              <CalendarClock /> Schedule monthly
            </Button>
          )}
          {acts.includes("send") && (
            <Button variant="primary" data-auto="send" disabled={!active} onClick={() => w.respond("send")}>
              <Send /> Send to owners
            </Button>
          )}
        </>
      }
    >
      <div className="ag-report">
        <button type="button" className="ag-report-pv" onClick={() => setOpen(true)} aria-label="Open preview">
          <Page p={p} />
          <span className="ag-report-zoom">
            <Maximize2 /> Preview
          </span>
        </button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="ag-report-modal">
          <div className="ag-report-mh">
            <span className="mono">{p.file}</span>
            <button type="button" className="z-btn z-btn--ghost z-btn--sm z-iconbtn" aria-label="Close" onClick={() => setOpen(false)}>
              <X />
            </button>
          </div>
          <Page p={p} big />
        </div>
      </Modal>
    </Frame>
  );
});
