import type { Skill } from "../../engine";
import takePayment from "./takePayment";

// Skills in the "money" category. One skill per file in this folder; list them here.
// See src/agent/AUTHORING.md.
export const skills: Skill[] = [takePayment];
