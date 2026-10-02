import type { Skill } from "../../engine";
import sendMessages from "./sendMessages";

// Skills in the "comms" category. One skill per file in this folder; list them here.
// See src/agent/AUTHORING.md.
export const skills: Skill[] = [sendMessages];
