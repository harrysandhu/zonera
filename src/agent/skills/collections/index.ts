import type { Skill } from "../../engine";
import sweep from "./sweep";
import aging from "./aging";
import lien from "./lien";
import paymentPlan from "./paymentPlan";

// Skills in the "collections" category. One skill per file in this folder; list them here.
// See src/agent/AUTHORING.md.
export const skills: Skill[] = [sweep, aging, lien, paymentPlan];
