import React from "react";
import { BarChart, LineChart, MeterList } from "../../../ui/charts";
import { fmt } from "../../../state/store";
import type { ChartSpec } from "./types";

const F = {
  money: (v: number) => fmt.money(v),
  pct: (v: number) => (v * 100).toFixed(1) + "%",
  int: (v: number) => String(Math.round(v)),
};

/** Render a ChartSpec with the shared charts in src/ui/charts.tsx. */
export function ChartView({ spec, height }: { spec: ChartSpec; height?: number }) {
  const format = F[spec.format ?? "int"];
  const h = spec.height ?? height ?? 168;
  if (spec.kind === "line") return <LineChart data={spec.data} height={h} format={format} domain={spec.domain} />;
  if (spec.kind === "meter") return <MeterList rows={spec.data.map(d => ({ label: d.label, value: d.value, tone: d.value < 0.85 ? "warn" : "accent" }))} />;
  return <BarChart data={spec.data} height={h} format={format} yFormat={spec.format === "money" ? v => "$" + Math.round(v / 1000) + "k" : format} />;
}
