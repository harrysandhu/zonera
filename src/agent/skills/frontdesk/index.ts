import type { Skill } from "../../engine";
import batchMoveIn from "./batchMoveIn";
import walkIn from "./walkIn";
import moveOut from "./moveOut";
import lookup from "./lookup";
import transfer from "./transfer";
import today from "./today";
import leaseExplain from "./leaseExplain";
import addendum from "./addendum";
import leaseReminders from "./leaseReminders";

// Skills in the "frontdesk" category. One skill per file in this folder; list them here.
// See src/agent/AUTHORING.md.
export const skills: Skill[] = [walkIn, batchMoveIn, moveOut, lookup, transfer, today, leaseExplain, addendum, leaseReminders];
