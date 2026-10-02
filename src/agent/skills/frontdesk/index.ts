import type { Skill } from "../../engine";
import batchMoveIn from "./batchMoveIn";
import walkIn from "./walkIn";
import moveOut from "./moveOut";

// Skills in the "frontdesk" category. One skill per file in this folder; list them here.
// See src/agent/AUTHORING.md.
export const skills: Skill[] = [walkIn, batchMoveIn, moveOut];
