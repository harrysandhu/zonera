import type { Skill } from "../../engine";
import available from "./available";
import ownerReport from "./ownerReport";
import revenueBySize from "./revenueBySize";
import schedule from "./schedule";

// Skills in the "reports" category. One skill per file in this folder; list them here.
// See src/agent/AUTHORING.md.
export const skills: Skill[] = [available, ownerReport, revenueBySize, schedule];
