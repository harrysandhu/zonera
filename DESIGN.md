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

## Visual rules

- **Tokens only.** Every color comes from `src/styles/tokens.css` (`--ink`, `--surface`, `--line`, `--lake`, `--apricot`, `--ok/warn/bad/info/violet` and their `-soft` variants …). Never a literal color in area CSS, except the HUD (`--hud-*`) and the 3D scene. Both light and dark themes must read well; test both.
- **Apricot means "your unit / the thing to act on".** Use it sparingly: the selected unit, the primary call to action on the storefront, the agent's own accent. Primary buttons elsewhere are ink (`.z-btn--primary`).
- **Type:** `--f-ui` (Instrument Sans) for everything; `--f-display` (Fraunces, class `.display`) only for large moments (page heroes, big numbers, storefront headings); `--f-mono` (JetBrains Mono) for unit ids, gate codes, tool names, telemetry. Sentence case everywhere. 13–14px UI body, 11.5–12px labels.
- **Shapes:** radii `--r-xs/s/m/l`. Cards (`.z-card`) only where something is a separate object. Use layout gap, not margins between siblings.
- **Status** is encoded in form, not just text: `UnitStatusPill`, `Pill tone`, `StatusSwatch` (colors match the 3D doors via `STATUS_COLORS`).
- **Motion:** purposeful. Agent output streams in; widgets rise in (`z-rise`); state changes animate once. Respect `prefers-reduced-motion` (base.css already clamps).
- **No emoji, no lorem ipsum.** Real names, real units (A-122, D-209), real money.
- **Copy voice:** plain, specific, active. Buttons say what happens ("Record payment", "Send code"). The agent speaks like a sharp facility manager: short sentences, numbers first, never gushing.

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
