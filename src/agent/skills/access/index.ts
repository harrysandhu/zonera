import type { Skill } from "../../engine";
import gateCode from "./gateCode";
import gateLog from "./gateLog";
import revoke from "./revoke";
import lockout from "./lockout";

// Skills in the "access" category. One skill per file in this folder; list them here.
// See src/agent/AUTHORING.md.
export const skills: Skill[] = [gateCode, gateLog, revoke, lockout];
