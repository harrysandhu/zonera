import { movie } from "../state/store";
import { abort, activeSession, agent, ghostPress, isBusy, isHome, newSession, notify, run, setActive, typeDraft, uid, type Session } from "./engine";
import { parse } from "./parse";
import { route } from "./skills";
import { clock } from "../state/store";

// What the UI calls: send a message, launch an ask from the rail / chips / ⌘K.

/** Send the composer contents of a session. */
export function submit(s: Session, text: string, files: string[] = []) {
  const t = text.trim();
  if (!t && !files.length) return;
  if (isBusy(s)) abort(s.id);
  s.items.push({ t: "user", id: uid("u"), text: t, files, at: clock() });
  s.draft = "";
  s.files = [];
  s.suggest = [];
  notify();
  const { skill } = route(parse(t, files));
  void run(s, skill, { text: t, files });
}

const typing = new Set<string>();

/** Ask in a given session. In movie mode the text is typed and Send is pressed on screen. */
export async function askIn(s: Session, text: string, files: string[] = []) {
  if (typing.has(s.id)) return;
  if (movie.on && agent.activeId === s.id) {
    typing.add(s.id);
    try {
      s.files = files;
      await typeDraft(s, text);
      const btn = document.querySelector(`[data-session="${s.id}"] [data-auto="send"]`);
      if (btn) await ghostPress(btn);
      else submit(s, s.draft, s.files);
    } finally {
      typing.delete(s.id);
    }
    return;
  }
  submit(s, text, files);
}

/** Start an ask from the rail, a home card or ⌘K: reuse a fresh session or open a new tab. */
export function launch(text: string, files: string[] = [], opts: { newTab?: boolean } = {}) {
  let s = activeSession();
  if (!s || opts.newTab || !isHome(s) || isBusy(s)) {
    const home = agent.sessions.find(x => x.open && isHome(x) && !isBusy(x));
    s = home && !opts.newTab ? home : newSession();
  }
  setActive(s.id);
  // Let the tab mount before typing into it.
  window.setTimeout(() => void askIn(s!, text, files), movie.on ? 260 : 0);
}

export function newTab() {
  const home = agent.sessions.find(x => x.open && isHome(x) && !isBusy(x));
  setActive((home ?? newSession()).id);
}
