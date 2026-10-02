# Zonera — build conventions

Read `PLAN.md` first. This file is how we build it.

## Stack

Vite + React 18 + TypeScript, vanilla Three.js (r159) wrapped by `src/three/FacilityView.tsx`, icons from `lucide-react`. No other UI libraries. Classic JSX runtime: every `.tsx` file starts with `import React from "react"`.

`npm run dev` → http://127.0.0.1:5173 · `npx tsc --noEmit` must pass · `npm run build` produces `dist/index.html` and `dist/artifact.html` (React, ReactDOM and three load from pinned CDN builds; images ship as files in `img/`).

## Ownership

| Area | Directory | CSS prefix | Stylesheet |
|---|---|---|---|
| Shared primitives, tokens, shell, routing, state | `src/ui`, `src/styles/{tokens,base,ops-shell}.css`, `src/state`, `src/ops/OpsShell.tsx`, `src/App.tsx` | `z-`, `os-` | — |
| Domain data | `src/data` (read; add new files, don't rewrite existing exports) | — | — |
| 3D engine | `src/three` | `fx-` | — |
| Storefront, checkout, access | `src/store` | `st-` | `src/styles/store.css` |
| Operator pages | `src/ops/pages` | `op-` | `src/styles/ops-pages.css` |
| Agent mode | `src/agent` | `ag-` | `src/styles/agent.css` |
| Call center | `src/calls` | `cc-` | `src/styles/calls.css` |
| Brand page | `src/brand` | `br-` | `src/styles/brand.css` |
| **Reserved:** Super Admin portal + Automated FDE (sibling session, branch `claude/sleepy-newton-gwb357`) | `src/admin` | `sa-` (super admin), `ob-` (owner onboarding portal) | its own files; hash routes `#admin…` and `#onboard…` |

Stay inside your directory. Import your stylesheet from your own entry component. If you need a change in a shared file, say so in your report instead of editing it.

## Visual rules (v2 — modern AI SaaS)

References: The General Intelligence Company of New York and The Browser Company (Dia). Neutral paper and ink, Geist + Geist Mono, one pure blue, plain product copy. **The current reference screen is the Overview page (`src/ops/pages/OverviewPage.tsx`).** Match it.

- **Type:** Geist for everything (`--f-ui`, `--f-display` both Geist). Page titles 21px/600/−0.028em; section titles 13px/550; body 13–14px; stat numbers 24px/550/−0.035em. **Geist Mono** (`--f-mono`, `.eyebrow`, `.mono`) for small labels, ids (A-126), codes, deltas, chart ticks, timestamps. No serif anywhere. Sentence case.
- **Color:** tokens only (`src/styles/tokens.css`). Ink/paper/surfaces are neutral with a faint green-grey cast. **One accent: blue `--accent`** for selection, the agent, links, the primary chart series, and "your unit". No yellow, orange, apricot or gradients. Status colors (ok/warn/bad/violet) only for state. Legacy names `--apricot`/`--lake` now alias the blue.
- **Surfaces:** the page sits in an inset white panel; sections are bordered (1px `--line`), radius 12px, no shadows except tiny `--shadow-s` on buttons. KPI rows are one bordered strip divided by hairlines (`StatRow`).
- **Controls:** 32px buttons (28px small), radius 8px, primary = ink; chips 28px radius 7px; pills 20px radius 6px.
- **3D:** clay look (white massing, grey ground, grey doors), status colors on doors in ops mode, blue for selection/available/route.
- **Copy:** modern AI-SaaS. Plain, confident, specific ("3 things need you today", "Rent a unit in two minutes", "Self-storage software that runs itself"). No slogans, no "Just ask.", no poetry, no exclamation marks, no emoji.
- **Motion:** quiet. Streams in, widgets rise 6–8px once. Respect reduced motion.

## Shared APIs (src/state/store.ts)

- `useDemo()` — call in any component that displays domain data; re-renders on change.
- `commit({ kind, text, who })` — after mutating `UNITS`/`TENANTS`/etc., broadcast and log to the activity feed.
- `toast({ title, body, tone, action })`.
- `go("ops/tenants/T-1000")`, `nav.route`, `routeParts()`, `askAgent(text)`, `setCallsOpen(bool)`.
- `movie.on` — when true, scripted flows auto-play (type, pause, click) at watchable speed. `sleep(ms)` respects `movie.speed`.
- `fmt.money/pct/date/short`, `clock()`.

## Data (src/data)

- `facility.ts` — `FACILITY`, `BUILDINGS`, `UNITS` (181, ids like `A-126`, `D-209`, `P-5`), `UNIT_BY_ID`, `SIZE_INFO`, `STORY_UNITS`, `availableUnits()`, `occupancy()`, `routeTo(unitId)`.
- `tenants.ts` — `TENANTS` (story cast first: Matthew Okafor/Alvarez/Cho, Sofia Reyes, Dana Whitfield, Ben Carter, Grace Lindqvist), `TENANT_BY_ID`, `tenantForUnit()`, `findTenants()`, `DELINQUENT`, `MONTHLY`, `SEPT_LAST_YEAR`, `FEED`, `LEADS`, `OPERATOR`.
- `catalog.ts` — storefront items, presets, `recommend()`, `PROTECTION`, `ADMIN_FEE`.
- The demo day is **Friday, October 2, 2026**, starting 9:44 am.

## 3D (src/three)

`<FacilityView mode="store|ops|hud|twin" selected pulse route follow statuses extrudeKey flyTo labels onSelect onHover />`. Keep to one or two live views per screen (WebGL context limits). Labels are React nodes anchored to a unit (`unitId`) or the car (`at: "car"`).

## Verify

```sh
npx tsc --noEmit
node scripts/shot.mjs "http://127.0.0.1:5173/#ops-tenants" /tmp/…/out.png 1440 900 2500        # light
node scripts/shot.mjs "http://127.0.0.1:5173/#ops-tenants" /tmp/…/out-dark.png 1440 900 2500 1   # dark
```

Hash routes: `#store`, `#store-checkout`, `#store-access`, `#ops-overview`, `#ops-tenants-T-1000`, `#ops-agent`, `#brand`. Look at every screenshot you take and fix what you see.
