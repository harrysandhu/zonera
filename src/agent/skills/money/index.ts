import type { Skill } from "../../engine";
import takePayment from "./takePayment";
import autopay from "./autopay";
import refund from "./refund";
import waive from "./waive";

// Skills in the "money" category. One skill per file in this folder; list them here.
// See src/agent/AUTHORING.md.
export const skills: Skill[] = [takePayment, autopay, refund, waive];
