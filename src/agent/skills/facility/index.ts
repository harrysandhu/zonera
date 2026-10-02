import type { Skill } from "../../engine";
import maintenance from "./maintenance";

// Skills in the "facility" category. One skill per file in this folder; list them here.
// See src/agent/AUTHORING.md.
export const skills: Skill[] = [maintenance];
