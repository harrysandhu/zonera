import type { Skill } from "../engine";
import type { Parsed } from "../parse";
import { skills as day } from "./day";
import { skills as frontdesk } from "./frontdesk";
import { skills as money } from "./money";
import { skills as collections } from "./collections";
import { skills as access } from "./access";
import { skills as facility } from "./facility";
import { skills as growth } from "./growth";
import { skills as comms } from "./comms";
import { skills as reports } from "./reports";
import { skills as admin } from "./admin";
import fallback from "./fallback";

// Every skill, in rail order. Category agents add skills to their own index.ts.
export const SKILLS: Skill[] = [...day, ...frontdesk, ...money, ...collections, ...access, ...facility, ...growth, ...comms, ...reports, ...admin];

export const MIN_SCORE = 3;

/** Pick the best skill for a parsed prompt, or the fallback. */
export function route(q: Parsed): { skill: Skill; score: number } {
  let best: Skill | null = null;
  let score = 0;
  for (const s of SKILLS) {
    let v = 0;
    try {
      v = s.match(q);
    } catch (e) {
      console.warn("skill match failed", s.id, e);
    }
    if (v > score) {
      best = s;
      score = v;
    }
  }
  return best && score >= MIN_SCORE ? { skill: best, score } : { skill: fallback, score: 0 };
}

export function skillById(id: string) {
  return SKILLS.find(s => s.id === id) ?? (id === fallback.id ? fallback : undefined);
}

export { fallback };
