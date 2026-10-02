# Agent skill builders — shared brief

Five sub-agents implement the 76 actions in `docs/agent-catalog.md` on top of the engine owned by the agent-mode builder. This is the shared part of their brief.

## Ownership
| Builder | Actions | Skills folder(s) | Widgets folder(s) + registry file | Owns these widgets |
|---|---|---|---|---|
| Engine / workspace | engine, parser, registry, workspace UI, reference skills #13, #55, #68 (handed over after) | — | `widgets/core/` | W1–W5, W9, W10, W12, W13, W15, W29–W31, W39, W42 |
| Front desk | 1–12 | `skills/frontdesk/` | `widgets/frontdesk/`, `widgets/ext/frontdesk.ts` | W19–W25, W33 (SlotPicker, shared) |
| Money & collections | 13–30 (+ owns #13 file after hand-over) | `skills/money/`, `skills/collections/` | `widgets/money/`, `widgets/collections/`, `widgets/ext/{money,collections}.ts` | W14 PaymentForm (shared, build first), W16–W18, W32, W41, CashDrawer, TapToPay, CheckCapture |
| Access & facility | 31–45 (+ "adjust a unit": rate, status, attributes, notes) | `skills/access/`, `skills/facility/` | `widgets/access/`, `widgets/facility/`, `widgets/ext/{access,facility}.ts` | W26–W28, W36–W38 |
| Growth & messages | 46–59 (+ owns #55 file after hand-over) | `skills/growth/`, `skills/comms/` | `widgets/growth/`, `widgets/comms/`, `widgets/ext/{growth,comms}.ts` | W6, W7, W34, W35 |
| Reports, day & admin | 60–76 (+ owns #68 file after hand-over) | `skills/reports/`, `skills/day/`, `skills/admin/` | `widgets/reports/`, `widgets/day/`, `widgets/admin/`, `widgets/ext/{reports,day,admin}.ts` | W8, W11, W40 |

Shared widgets are imported from their owner's folder by type name through the registry. Never edit another builder's files; if you need a change, send it to the lead in your report.

## Quality bar for every action
- At least 2 example prompts that work when typed (first one is canonical).
- Slots with sensible defaults, editable chips, at most one question when something is missing.
- A widget only where a person should decide or look; realistic, correct numbers (proration, change due, fees).
- Effects mutate `src/data` and call `commit()` so the dashboard, profiles and twin update; a receipt with deep links (`go("ops/tenants/…")`) and Undo where sensible; 2–3 next-step chips.
- Movie-mode scripted answers for every widget.
- Design v2 (DESIGN.md): Geist / Geist Mono, neutral, one blue, no serif/yellow/orange/gradients/emoji/slogans.
