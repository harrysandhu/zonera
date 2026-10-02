import React, { useState } from "react";
import { ArrowRight, ArrowUpRight, Building2, Clock, Copy, KeyRound, MapPin, Minus, Phone, Plus, Receipt, Star, Truck, Users } from "lucide-react";
import { FACILITY, SIZE_INFO, UNITS, type UnitSize } from "../data/facility";
import { toast, useDemo } from "../state/store";
import { Button, Mark, Wordmark } from "../ui";
import { UNIT_IMG } from "../assets";
import { GATE_CODE, SIZE_ORDER, availableOf, sizeLabel } from "./order";

// ---- Sizes ------------------------------------------------------------------

export function Sizes({ onPick }: { onPick: (size: UnitSize) => void }) {
  useDemo();
  return (
    <div className="st-sizes">
      {SIZE_ORDER.map(size => {
        const info = SIZE_INFO[size];
        const all = UNITS.filter(u => u.size === size);
        const avail = availableOf(size);
        const from = Math.min(...all.map(u => u.rate));
        const kinds = Array.from(new Set(all.map(u => u.kind)));
        return (
          <button key={size} className="st-size" onClick={() => onPick(size)}>
            <div className="st-size-img">{size === "12x40" ? <ParkingArt /> : <img src={UNIT_IMG[size]} alt={`${sizeLabel(size)} unit with stored furniture`} />}</div>
            <div className="st-size-b">
              <div className="st-size-t">
                <h3>{size === "12x40" ? "RV & boat" : sizeLabel(size)}</h3>
                <span className="mono">{size === "12x40" ? "12 × 40 ft" : `${info.sqft} sq ft`}</span>
              </div>
              <p className="st-size-like">{info.like}</p>
              <p className="st-size-fits">{info.fits}</p>
              <div className="st-tags">
                {kinds.includes("drive-up") && <span>Drive-up</span>}
                {kinds.includes("climate") && <span>Climate</span>}
                {kinds.includes("parking") && <span>Uncovered</span>}
                {size === "10x10" && <span>Most popular</span>}
              </div>
            </div>
            <div className="st-size-f">
              <span>
                From <b className="tnum">${from}</b>/mo
              </span>
              <span className={`st-avail ${avail.length <= 1 ? "low" : ""} ${avail.length === 0 ? "none" : ""}`}>
                <i />
                {avail.length === 0 ? "Waitlist" : avail.length === 1 ? "1 left" : `${avail.length} available`}
              </span>
            </div>
          </button>
        );
      })}
      <div className="st-size st-size--ask">
        <div>
          <span className="eyebrow">Not sure?</span>
          <h3>Describe it instead</h3>
          <p>Type what you're storing and we'll work out the size, then show you the exact door.</p>
        </div>
        <Button onClick={() => document.getElementById("st-ask")?.focus()}>
          Describe my things <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

function ParkingArt() {
  // Plain clay drawing of an RV bay, on the same warm white as the painted cutaways.
  return (
    <svg viewBox="0 0 400 300" className="st-park" aria-label="RV and boat parking space">
      <path d="M40 210 L210 120 L370 190 L200 280 Z" fill="#e9e6df" />
      <path d="M40 210 L200 280 L200 290 L40 220 Z" fill="#d9d5cc" />
      <path d="M200 280 L370 190 L370 200 L200 290 Z" fill="#cfcac0" />
      {[0, 1, 2].map(i => (
        <path key={i} d={`M${82 + i * 84} ${188 - i * 44} L${242 + i * 84} ${258 - i * 44}`} stroke="#fbfaf7" strokeWidth="3" strokeLinecap="round" opacity={i === 1 ? 0 : 1} />
      ))}
      <g>
        <path d="M150 196 L232 153 L300 183 L218 226 Z" fill="#c9cdd2" opacity=".5" />
        <path d="M126 168 L208 125 L276 155 L194 198 Z" fill="#ffffff" stroke="#c9c5bc" />
        <path d="M126 168 L194 198 L194 226 L126 196 Z" fill="#f1efea" stroke="#c9c5bc" />
        <path d="M194 198 L276 155 L276 183 L194 226 Z" fill="#e6e3dc" stroke="#c9c5bc" />
        <path d="M206 205 L262 176 L262 186 L206 215 Z" fill="#0358f7" opacity=".85" />
        <path d="M140 185 L160 194 L160 206 L140 197 Z" fill="#cdd9ec" />
        <circle cx="152" cy="214" r="7" fill="#3a3d3a" />
        <circle cx="182" cy="228" r="7" fill="#3a3d3a" />
      </g>
      <text x="300" y="250" fontFamily="Geist Mono, monospace" fontSize="13" fill="#8d918d">
        P-5
      </text>
    </svg>
  );
}

// ---- Business -----------------------------------------------------------------

export function Business({ onSize }: { onSize: () => void }) {
  const points = [
    { icon: <Truck />, t: "We sign for deliveries", d: "Freight and parcels received at the office, 9–6 Mon–Sat. You get a photo when it lands." },
    { icon: <Users />, t: "Your whole team", d: "Add staff with their own gate codes and hours. Remove them in one tap." },
    { icon: <Receipt />, t: "Invoices that reconcile", d: "Monthly PDF invoices, one card or ACH for every unit, exports for QuickBooks." },
  ];
  return (
    <div className="st-biz">
      <div className="st-biz-h">
        <span className="eyebrow">For business</span>
        <h2>Inventory, tools and records, close to the job</h2>
        <p>Contractors, shops and caterers around the lake keep their overflow here. 10×20 and 10×30 drive-ups fit a pallet jack and a van at the door.</p>
        <Button onClick={onSize}>
          Size a business unit <ArrowRight />
        </Button>
      </div>
      <ul>
        {points.map(p => (
          <li key={p.t}>
            <span className="st-biz-ic">{p.icon}</span>
            <div>
              <b>{p.t}</b>
              <p>{p.d}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- How it works ---------------------------------------------------------------

export function HowItWorks() {
  return (
    <ol className="st-how">
      <li>
        <div className="st-how-v st-how-v1">
          <div className="st-mini-rec">
            <span className="eyebrow">Recommended</span>
            <b>10×10</b>
            <div className="st-meter st-meter--sm">
              <i style={{ width: "56%" }} />
            </div>
            <span className="mono">56% full · 7 available</span>
          </div>
        </div>
        <span className="st-how-n mono">01</span>
        <h3>Pick your unit</h3>
        <p>Tell us what you're storing. We size it and show you the exact door on the map, with today's price.</p>
      </li>
      <li>
        <div className="st-how-v st-how-v2">
          <div className="st-mini-sign">
            <span className="st-sign-ink">Maya Chen</span>
            <i />
            <span className="mono">Signed Oct 2 · 9:47 am</span>
          </div>
        </div>
        <span className="st-how-n mono">02</span>
        <h3>Rent online</h3>
        <p>Pick a move-in date, add protection, verify your ID and sign the lease. It takes about two minutes.</p>
      </li>
      <li>
        <div className="st-how-v st-how-v3">
          <div className="st-mini-gate">
            <span className="eyebrow">Gate code</span>
            <b className="mono">{GATE_CODE}#</b>
            <span className="mono">A-126 · 246 ft from the gate</span>
          </div>
        </div>
        <span className="st-how-n mono">03</span>
        <h3>Drive in</h3>
        <p>Your gate code arrives by text with a map from the gate to your door. No office visit, no paperwork.</p>
      </li>
    </ol>
  );
}

// ---- Location ---------------------------------------------------------------------

export function Location() {
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked */
    }
    toast({ title: `${what} copied`, body: text, tone: "ok" }, 2600);
  };
  return (
    <div className="st-loc">
      <dl className="st-loc-l">
        <div>
          <dt>
            <MapPin /> Address
          </dt>
          <dd>
            <span className="st-sel">{FACILITY.address}</span>
            <button className="st-copy" onClick={() => copy(FACILITY.address, "Address")} aria-label="Copy address">
              <Copy />
            </button>
          </dd>
        </div>
        <div>
          <dt>
            <KeyRound /> Gate
          </dt>
          <dd>{FACILITY.gateHours}</dd>
        </div>
        <div>
          <dt>
            <Clock /> Office
          </dt>
          <dd>{FACILITY.officeHours}</dd>
        </div>
        <div>
          <dt>
            <Phone /> Phone
          </dt>
          <dd>
            <a className="st-sel" href={`tel:${FACILITY.phone.replace(/\D/g, "")}`}>
              {FACILITY.phone}
            </a>
            <button className="st-copy" onClick={() => copy(FACILITY.phone, "Phone number")} aria-label="Copy phone number">
              <Copy />
            </button>
          </dd>
        </div>
        <div>
          <dt>
            <Building2 /> On site
          </dt>
          <dd>Drive-up units, climate-controlled Building D with an elevator, RV and boat spaces, lock sales, cart and dolly loan.</dd>
        </div>
        <div className="st-loc-a">
          <Button variant="primary" onClick={() => toast({ title: "Directions", body: "Opening maps to 2200 Shoreline Drive.", tone: "info" }, 2600)}>
            Get directions <ArrowUpRight />
          </Button>
          <Button onClick={() => toast({ title: "Calling the office", body: FACILITY.phone, tone: "call" }, 2600)}>
            <Phone /> Call
          </Button>
        </div>
      </dl>
      <div className="st-loc-map">
        <MapArt />
      </div>
    </div>
  );
}

function MapArt() {
  return (
    <svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" aria-label="Map: the facility sits on Shoreline Drive at the south shore of Alder Lake">
      <rect width="640" height="400" className="m-land" />
      <path d="M0 0 H640 V118 C560 140 500 112 430 128 C350 146 300 108 220 122 C140 136 70 104 0 126 Z" className="m-water" />
      <path d="M0 126 C70 104 140 136 220 122 C300 108 350 146 430 128 C500 112 560 140 640 118" className="m-shore" />
      {/* parcels */}
      {[
        [40, 190, 90, 60],
        [40, 280, 90, 80],
        [534, 196, 100, 52],
        [534, 272, 54, 96],
        [600, 272, 60, 96],
      ].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="4" className="m-parcel" />
      ))}
      {/* roads */}
      <path d="M-10 168 C120 150 200 182 320 168 C440 154 520 176 650 160" className="m-road-c" />
      <path d="M-10 168 C120 150 200 182 320 168 C440 154 520 176 650 160" className="m-road" />
      <path d="M500 410 C494 330 470 250 452 170" className="m-road-c" />
      <path d="M500 410 C494 330 470 250 452 170" className="m-road" />
      <path d="M150 168 L150 186" className="m-drive" />
      {/* the facility */}
      <g transform="translate(176 196)">
        <rect x="-38" y="-10" width="190" height="140" rx="6" className="m-site" />
        <rect x="-26" y="2" width="44" height="38" rx="2" className="m-bldg" />
        <rect x="30" y="2" width="110" height="12" rx="2" className="m-bldg" />
        <rect x="30" y="28" width="110" height="18" rx="2" className="m-bldg" />
        <rect x="30" y="60" width="110" height="12" rx="2" className="m-bldg" />
        <rect x="-26" y="62" width="18" height="12" rx="2" className="m-bldg" />
        <rect x="80" y="90" width="50" height="22" rx="2" className="m-lot" />
      </g>
      <text x="300" y="72" className="m-label m-label--water">
        ALDER LAKE
      </text>
      <text x="520" y="150" className="m-label">
        SHORELINE DR
      </text>
      <text x="474" y="352" className="m-label" transform="rotate(-80 474 352)">
        LAKEVIEW RD
      </text>
      <g transform="translate(240 236)">
        <circle r="22" className="m-pin-halo" />
        <circle r="8" className="m-pin" />
        <circle r="3" fill="#fff" />
      </g>
      <g transform="translate(270 214)">
        <rect width="170" height="44" rx="8" className="m-card" />
        <text x="12" y="19" className="m-card-t">
          Zonera Alder Lake
        </text>
        <text x="12" y="34" className="m-card-s">
          2200 Shoreline Dr · open now
        </text>
      </g>
    </svg>
  );
}

// ---- Reviews ----------------------------------------------------------------------

const REVIEWS = [
  { q: "Rented a 10×10 from the parking lot of my old apartment. The gate code came by text before I'd started the truck.", n: "Jordan Ellis", m: "10×10 drive-up · since Aug 2026" },
  { q: "The size finder said 5×10 for my studio and it was right, with room to walk to the back. Climate building is spotless.", n: "Priscilla Nakamura", m: "5×10 climate · since May 2026" },
  { q: "We keep the boat here over winter. Billing is automatic and the map to our space made the first visit painless.", n: "Ray & Colleen Dorsey", m: "RV & boat · since Nov 2025" },
];

export function Reviews() {
  return (
    <div className="st-reviews">
      {REVIEWS.map(r => (
        <figure key={r.n}>
          <div className="st-stars" aria-label="5 out of 5">
            {[0, 1, 2, 3, 4].map(i => (
              <Star key={i} />
            ))}
          </div>
          <blockquote>{r.q}</blockquote>
          <figcaption>
            <b>{r.n}</b>
            <span className="mono">{r.m}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

// ---- FAQ ------------------------------------------------------------------------------

const FAQS = [
  { q: "Is there a long-term contract?", a: "No. Every rental is month to month. Give 10 days' notice from your account and billing stops at the end of your paid month." },
  { q: "What do I need to move in?", a: "A government photo ID and a card. You verify your ID with your phone during checkout, so there's nothing to bring to the office. Bring your own lock, or buy a disc lock at the office for $15." },
  { q: "When can I get in?", a: "The gate is open 6:00 am to 10:00 pm every day. Your code works on the gate keypad and, for climate units, the Building D door." },
  { q: "Do I need insurance?", a: "Your things need to be covered. Add a protection plan at checkout (from $12 a month for $2,000 of coverage), or upload your own homeowners or renters policy." },
  { q: "Can I change units later?", a: "Yes. Move up or down a size any time from your account. We prorate the difference to the day, and there's no new admin fee." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="st-faq">
      {FAQS.map((f, i) => (
        <div key={f.q} className={`st-faq-i ${open === i ? "open" : ""}`}>
          <button aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            <span>{f.q}</span>
            {open === i ? <Minus /> : <Plus />}
          </button>
          <div className="st-faq-a" hidden={open !== i}>
            <p>{f.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Footer -----------------------------------------------------------------------------

export function Footer({ jump }: { jump: (id: string) => void }) {
  return (
    <footer className="st-foot">
      <div className="st-wrap st-foot-in">
        <div className="st-foot-brand">
          <div className="st-brand">
            <Mark size={22} />
            <Wordmark size={19} />
            <span className="st-brand-site">Alder Lake</span>
          </div>
          <p>{FACILITY.address}</p>
          <p className="mono">{FACILITY.phone}</p>
        </div>
        <nav>
          <b>Storage</b>
          <button onClick={() => jump("st-sizes")}>Unit sizes</button>
          <button onClick={() => jump("st-finder")}>Size finder</button>
          <button onClick={() => jump("st-business")}>Business storage</button>
          <button onClick={() => jump("st-sizes")}>RV & boat parking</button>
        </nav>
        <nav>
          <b>Facility</b>
          <button onClick={() => jump("st-location")}>Location & hours</button>
          <button onClick={() => jump("st-how")}>How it works</button>
          <button onClick={() => jump("st-faq")}>Questions</button>
        </nav>
        <nav>
          <b>Account</b>
          <button onClick={() => toast({ title: "Pay your bill", body: "Sign in with your phone number to pay.", tone: "info" }, 2600)}>Pay my bill</button>
          <button onClick={() => toast({ title: "Gate code", body: "Sign in to see or change your gate code.", tone: "info" }, 2600)}>Gate code</button>
          <button onClick={() => toast({ title: "Move out", body: "Sign in to give notice. Billing stops at the end of your month.", tone: "info" }, 2600)}>Move out</button>
        </nav>
      </div>
      <div className="st-wrap">
        <div className="st-foot-b">
          <span>© 2026 Zonera Alder Lake</span>
          <span>
            Runs on <b>Zonera</b>
          </span>
        </div>
      </div>
    </footer>
  );
}
