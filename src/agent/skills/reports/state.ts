import { commit, toast } from "../../../state/store";
import type { ChartData } from "../../widgets/reports/ChartCard";

// Runtime state the reports skills share with their widgets: charts added to
// the next report from chat, saved report schedules, and exported files.

export interface ReportExtra {
  id: string;
  title: string;
  chart: ChartData;
  note?: string;
  at: string;
}

export interface ReportSchedule {
  id: string;
  report: string; // "Owner report"
  cadence: string; // "1st of every month, 6:00 am"
  to: string[]; // names
  format: string; // "PDF and CSV"
  next: string; // "Nov 1"
  by: string;
  fresh?: boolean;
}

export interface ExportRec {
  id: string;
  file: string;
  rows: number;
  at: string;
}

export const REPORTS = {
  extras: [] as ReportExtra[],
  schedules: [
    { id: "sch-owner", report: "Owner report", cadence: "1st of every month, 6:00 am", to: ["Daniel Osei", "Priya Raman"], format: "PDF and CSV", next: "Nov 1", by: "Priya Raman" },
    { id: "sch-aging", report: "Delinquency aging", cadence: "Every day, 6:00 am", to: ["Priya Raman"], format: "Link", next: "Tomorrow 6:00 am", by: "Priya Raman" },
  ] as ReportSchedule[],
  exports: [] as ExportRec[],
};

/** "Add to report" from a ChartCard: the next owner report includes it as a section. */
export function addToReport(x: Omit<ReportExtra, "at">) {
  if (REPORTS.extras.some(e => e.id === x.id)) return false;
  REPORTS.extras.push({ ...x, at: new Date().toISOString() });
  commit({ kind: "agent", text: `Added "${x.title}" to the October owner report`, who: "Priya Raman" });
  toast({ title: "Added to the October owner report", body: x.title, tone: "ok", action: { label: "Reports", route: "ops/reports/owner" } });
  return true;
}

export function removeFromReport(id: string) {
  const i = REPORTS.extras.findIndex(e => e.id === id);
  if (i >= 0) REPORTS.extras.splice(i, 1);
  commit();
}

export function isInReport(id: string) {
  return REPORTS.extras.some(e => e.id === id);
}
