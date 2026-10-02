import React, { useState } from "react";
import { ArrowRight, Copy, Check } from "lucide-react";
import { go } from "../state/store";
import { HERO, UNIT_IMG } from "../assets";
import { Mark, Wordmark } from "../ui";
import { FacilityView } from "../three/FacilityView";
import "../styles/brand.css";

// Brand guide — mirrors the structure of the Dray guide: plate, idea, signature,
// color, type, world, 3D language, voice, motion, and how the art was made.

const COLORS = [
  { name: "Ink", hex: "#1D1F1D", role: "Text, primary buttons, the wordmark", token: "--ink" },
  { name: "Paper", hex: "#F8F9F7", role: "App background and sidebar", token: "--paper" },
  { name: "Surface", hex: "#FFFFFF", role: "Panels, cards, inputs", token: "--surface" },
  { name: "Mist", hex: "#F2F4F1", role: "Wells, hover, quiet fills", token: "--surface-2" },
  { name: "Graphite", hex: "#5E625E", role: "Secondary text", token: "--ink-2" },
  { name: "Accent", hex: "#0358F7", role: "Selection, the agent, links, your unit", token: "--accent" },
  { name: "Success", hex: "#15803D", role: "Paid, available, done", token: "--ok" },
  { name: "Danger", hex: "#D92D20", role: "Overlocked, failed, overdue", token: "--bad" },
];

const VOICE = [
  { moment: "Ask for what it needs", line: "Which Matthew — Okafor in A-122 or Alvarez in B-122?" },
  { moment: "Confirm before money moves", line: "Record $240 cash for Matthew Okafor and remove the overlock on A-122?" },
  { moment: "Report what happened", line: "Done. Balance is $0, A-122 is unlocked, receipt texted to (530) 555-0187." },
  { moment: "Say what it can't do", line: "I can't start a lien sale without your sign-off. Here's the timeline when you're ready." },
  { moment: "Recover", line: "The card on file was declined. I sent Grace a link to update it; I'll retry tonight." },
];

export function BrandPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(hex);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="br">
      <header className="br-nav">
        <div className="br-nav-l">
          <Mark size={24} />
          <Wordmark size={22} />
          <span className="br-nav-tag">Brand</span>
        </div>
        <nav>
          {[["br-idea", "Idea"], ["br-sign", "Signature"], ["br-color", "Color"], ["br-type", "Type"], ["br-world", "World"], ["br-voice", "Voice"], ["br-process", "Process"]].map(([id, label]) => (
            <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <section className="br-plate">
        <img src={HERO.clean} srcSet={`${HERO.small} 1280w, ${HERO.clean} 2400w`} sizes="100vw" alt="Painted lakeside landscape with a small self-storage facility" />
        <div className="br-plate-t">
          <Wordmark size={120} color="#111211" />
          <p>Self-storage software that runs itself.</p>
        </div>
      </section>

      <section className="br-sec br-idea" id="br-idea">
        <div className="br-label">The idea</div>
        <div className="br-body">
          <h2 className="br-h2">Self-storage software that runs itself.</h2>
          <p className="br-lede">
            Every storage system on the market is a database with forms on top, and you learn its screens before you can run your facility. Zonera is the first one you can simply talk to. The renter asks for a space; the manager asks for an outcome. The
            agent does the work and only stops to ask what a person should decide.
          </p>
          <p className="br-p">
            One agent runs the front desk, the books, the gate and the phones. The operator watches, approves what matters, and takes over when they want to.
          </p>
          <div className="br-pillars">
            <div>
              <b>Nothing to learn</b>
              <span>If a task needs a manual, we failed.</span>
            </div>
            <div>
              <b>Decisions, not forms</b>
              <span>Widgets appear only when a human should choose.</span>
            </div>
            <div>
              <b>Every action logged</b>
              <span>The agent asks before money or access changes, and shows its work.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="br-sec" id="br-sign">
        <div className="br-label">Signature</div>
        <div className="br-body">
          <div className="br-signs">
            <div className="br-sign br-sign--paper">
              <Wordmark size={84} />
            </div>
            <div className="br-sign br-sign--sky" style={{ backgroundImage: `url(${HERO.small})` }}>
              <Wordmark size={84} color="#111211" />
            </div>
            <div className="br-sign br-sign--ink">
              <Wordmark size={84} color="#FBFBF8" />
            </div>
          </div>
          <div className="br-grid3">
            <div>
              <h3 className="br-h3">Wordmark</h3>
              <p className="br-p">Lowercase <span className="mono">zonera</span> in Geist at weight 620, tracking −5.5%. Six letters, no capital, no period. Ink on paper and on the painted sky, paper on ink.</p>
            </div>
            <div>
              <h3 className="br-h3">Mark</h3>
              <div className="br-marks">
                <Mark size={56} />
                <Mark size={32} />
                <Mark size={20} />
              </div>
              <p className="br-p">A Z cut from a rounded square. Monochrome, always. Used for app icons, favicons and the sidebar.</p>
            </div>
            <div>
              <h3 className="br-h3">Clear space and size</h3>
              <p className="br-p">Keep clear space equal to the height of the <i>z</i> on every side. Minimum width 72px for the wordmark, 16px for the mark. Never outline, tilt, shadow or recolor it to a scene accent.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="br-sec" id="br-color">
        <div className="br-label">Color</div>
        <div className="br-body">
          <p className="br-p br-p--wide">Neutral paper and ink with a faint green-grey cast, and one blue. Blue marks what is selected, what the agent is doing and the unit that is yours. Success and danger are for state only. No gradients, no warm accents.</p>
          <div className="br-swatches">
            {COLORS.map(c => (
              <button key={c.name} className="br-swatch" onClick={() => copy(c.hex)} aria-label={`Copy ${c.name} ${c.hex}`}>
                <span className="br-chip" style={{ background: c.hex }} />
                <span className="br-sw-t">
                  <b>{c.name}</b>
                  <span className="mono">{copied === c.hex ? "Copied" : c.hex}</span>
                </span>
                <span className="br-sw-r">{c.role}</span>
                {copied === c.hex ? <Check size={14} className="br-sw-i" /> : <Copy size={14} className="br-sw-i" />}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="br-sec" id="br-type">
        <div className="br-label">Type</div>
        <div className="br-body br-type">
          <div className="br-spec">
            <div className="br-spec-h">
              <span>Display</span>
              <span className="mono">Geist · 600 · −3.5%</span>
            </div>
            <div className="br-spec-big">Rent a unit in two minutes.</div>
            <p className="br-p">Headlines and big numbers. Tight tracking, never all caps.</p>
          </div>
          <div className="br-spec">
            <div className="br-spec-h">
              <span>Interface</span>
              <span className="mono">Geist · 400–600</span>
            </div>
            <div className="br-spec-mid">Matthew Okafor paid $240.00 in cash. A-122 is unlocked.</div>
            <p className="br-p">Everything people read and operate: 13–14px, sentence case.</p>
          </div>
          <div className="br-spec">
            <div className="br-spec-h">
              <span>Labels, codes and data</span>
              <span className="mono">Geist Mono · 400–600</span>
            </div>
            <div className="br-spec-code">
              A-126 · <span>4827#</span> · gate.codes.create()
            </div>
            <p className="br-p">Unit ids, gate codes, tool names, deltas, timestamps and small uppercase labels.</p>
          </div>
          <div className="br-spec">
            <div className="br-spec-h">
              <span>Signatures</span>
              <span className="mono">Homemade Apple</span>
            </div>
            <div className="br-spec-sign">Maya Chen</div>
            <p className="br-p">Only where a person signs: leases and addenda.</p>
          </div>
        </div>
      </section>

      <section className="br-sec" id="br-world">
        <div className="br-label">World</div>
        <div className="br-body">
          <div className="br-world">
            <figure>
              <img src={HERO.small} alt="The clean production plate, with open sky for live type" />
              <figcaption>The production plate. The sky between 22% and 78% of the width is kept empty for live type.</figcaption>
            </figure>
            <div className="br-world-r">
              <h3 className="br-h3">Imagery, used sparingly</h3>
              <p className="br-p">One painted landscape, used as atmosphere on the storefront and in marketing. The product itself stays neutral; the painting never sits behind data or controls.</p>
              <h3 className="br-h3">The facility is in the scenery</h3>
              <p className="br-p">It sits in the lower middle, never the hero. Long low rows, a continuous rhythm of peach-coral roll-up doors, a timber building at the gate, hedges instead of chain-link. No signs, no unit numbers, no orange.</p>
              <h3 className="br-h3">Never</h3>
              <p className="br-p">Floating dioramas, tilt-shift blur, sunset skies, shipping containers, barbed wire, mascots, people as the subject.</p>
            </div>
          </div>
          <div className="br-units">
            {(["5x5", "5x10", "10x10", "10x15", "10x20", "10x30"] as const).map(s => (
              <figure key={s}>
                <img src={UNIT_IMG[s]} alt={`Painted cutaway of a ${s} unit`} />
                <figcaption className="mono">{s.replace("x", " × ")}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="br-sec" id="br-3d">
        <div className="br-label">3D language</div>
        <div className="br-body">
          <div className="br-twin">
            <FacilityView mode="store" view={{ zoom: 1.05, az: 0.62, el: 0.62 }} selected="A-126" idleSpin />
          </div>
          <div className="br-grid3">
            <div>
              <h3 className="br-h3">Storefront diorama</h3>
              <p className="br-p">The same facility, built from its site plan as a white clay model. Your unit gets a blue beam and a ring.</p>
            </div>
            <div>
              <h3 className="br-h3">Operator twin</h3>
              <p className="br-p">Doors take their unit's status: available, reserved, past due, overlocked, maintenance. Click any door to act on it.</p>
            </div>
            <div>
              <h3 className="br-h3">Route film</h3>
              <p className="br-p">After checkout, a dark map with blue lines: a car drives from the gate to your door, on a loop, with turn-by-turn callouts.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="br-sec" id="br-voice">
        <div className="br-label">Voice</div>
        <div className="br-body">
          <p className="br-p br-p--wide">Plain and specific, like the best AI products: numbers first, the person's name and unit, no slogans. The agent asks only what it needs, confirms before money or access changes, and says plainly what it did.</p>
          <div className="br-voice">
            {VOICE.map(v => (
              <div key={v.moment} className="br-voice-row">
                <span className="eyebrow">{v.moment}</span>
                <p>“{v.line}”</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="br-sec" id="br-motion">
        <div className="br-label">Motion</div>
        <div className="br-body br-grid3">
          <div>
            <h3 className="br-h3">Stream, then settle</h3>
            <p className="br-p">Agent text streams; tool calls tick from spinner to check; widgets rise 8px into place and stay still.</p>
          </div>
          <div>
            <h3 className="br-h3">The camera moves once</h3>
            <p className="br-p">In 3D the camera flies to the thing that matters and stops. Idle spin only where nothing is selected.</p>
          </div>
          <div>
            <h3 className="br-h3">Reduced motion</h3>
            <p className="br-p">Instant state changes, static scenes, no route loop. Nothing important depends on movement.</p>
          </div>
        </div>
      </section>

      <section className="br-sec" id="br-process">
        <div className="br-label">Process</div>
        <div className="br-body">
          <p className="br-p br-p--wide">The plate was made from three founder references (a painted lake meadow, a painted lake panorama, and a golden-hour photo of San Francisco from Dolores Park) and an adversarial prompt review before any credits were spent.</p>
          <ol className="br-steps">
            <li>
              <b>Draft</b>
              <span>“Isometric facility by an alpine lake, ‘zonera’ in the sky.”</span>
            </li>
            <li>
              <b>Attack</b>
              <span>Fifteen failure modes: “isometric” summons floating dioramas, the model's idea of storage is orange doors and barbed wire, roofs hide the doors from above, text leaks onto buildings, golden hour plus noon turns to mud.</span>
            </li>
            <li>
              <b>Decide</b>
              <span>Describe a camera, not a projection. Roll-up door rhythm as the one signifier. Peach-coral, not orange. One light statement. Clean plate first, wordmark added as an edit so both plates match.</span>
            </li>
            <li>
              <b>Generate</b>
              <span>Two cool variants and one warm variant with the SF reference; the three-row cool plate was chosen. Type is always set live in Geist, never baked into the image.</span>
            </li>
          </ol>
          <div className="br-explore">
            <figure>
              <img src="img/hero-1280.webp" alt="Selected clean plate" />
              <figcaption>Selected · three rows, curved drive</figcaption>
            </figure>
            <figure>
              <img src="img/hero-1280.webp" alt="Selected plate" style={{ objectPosition: "50% 80%" }} />
              <figcaption>Production crop · facility and drive</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <footer className="br-foot">
        <Wordmark size={30} />
        <span className="faint">Brand guide · October 2026</span>
        <button className="z-btn" onClick={() => go("store")}>
          See the storefront <ArrowRight />
        </button>
      </footer>
    </div>
  );
}
