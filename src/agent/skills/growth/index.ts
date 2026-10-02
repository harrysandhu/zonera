import type { Skill } from "../../engine";
import callLead from "./callLead";
import promo from "./promo";
import rates from "./rates";

// Skills in the "growth" category. One skill per file in this folder; list them here.
// See src/agent/AUTHORING.md.
export const skills: Skill[] = [callLead, promo, rates];
