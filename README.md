# TBO Inventory Intelligence

Decision support for travel inventory procurement. This is a front-end prototype that shows where forecast demand
may exceed reliable bookable supply, prices the trade-off between committing inventory and buying on the day, and
routes every recommendation through a recorded human approval.

> **Synthetic demo.** Every booking, search, rate, supplier and contract value in this app is generated from a fixed
> seed (`20261117`). Nothing here is TBO internal data. The app never purchases, holds or sells inventory.

**Live demo:** <https://tbo-inventory-intelligence.vercel.app>

---

## Why this exists

Travel distributors such as TBO buy inventory in three very different ways:

| Mode | Example | Risk |
| --- | --- | --- |
| **Committed inventory** | Contracted hotel room-nights, transfer slots, rail seats, cabins | Paying for inventory that never sells |
| **Live / API access** | Flight fares, ad-hoc availability | Losing margin and availability at peak demand |
| **Content negotiation** | Preferred supplier rates, release windows | Weak terms and cancellations |

The app turns those trade-offs into a weekly plan: forecast demand, estimate reliable supply, rank the gaps, and
allocate a limited budget to the opportunities with the best expected contribution per unit of spend.

## What is in the app

- **Overview** — budget, allocation, expected downside, weekly demand chart (actual vs forecast with a confidence
  band), highest-priority gaps and the current review queue.
- **Opportunities** — 1,568 forward opportunities across 7 product categories and 14 destinations. Search, filter by
  product / travel period / priority / action, sort by score, gap or date, and export the current view to CSV.
- **Opportunity detail** — demand forecast and range, reliable availability, estimated gap, plain-language rationale,
  supplier comparison, risk panel, transparent score breakdown, and the approve / edit / monitor / reject workflow.
- **Budget optimizer** — budget, currency, risk profile, horizon, product mix, reserve, supplier exposure cap and
  optional category caps. Shows allocation by product, top proposed purchases, the flight access plan, and a
  proposed-versus-last-run comparison.
- **Recommendations** — review queue with role-gated approval dialogs, rationale capture, a SHA-256 decision audit
  trail, and a completed-outcomes table with realised profit and forecast accuracy.
- **Suppliers** — rate, reliability, failure rate, flexibility and response time per supplier, 12-month rate history,
  and the open opportunities where each supplier is quoted.
- **Data & settings** — dataset coverage, CSV exports (history, opportunities, suppliers, recommendations, audit
  log), capped CSV import with per-row validation, audit-chain verification, profile/role, reset, and the explicit
  assumptions list.

## Product categories

Hotels · Flights · Transfers · Car rental · Experiences · Cruises · Rail

Hotels are the primary committed-inventory category. **Flights are deliberately modelled as live fare access**, never
pre-bought seats: the optimiser can recommend "Negotiate access" or "Prioritise live supply" and reserve an access
pool, but it cannot allocate a seat quantity.

## How the logic works

**Demand forecast.** A seeded weekly history of 104 weeks is blended with the same week last year:
`0.55 × last year + 0.45 × last 4-week average × category growth × event lift`. Forecast confidence comes from the
coefficient of variation of recent bookings and falls with distance from today.

**Reliable availability.** Supplier capacity is discounted by confirmation reliability and data freshness. A gap only
exists when forecast demand exceeds this discounted availability — a sold-out search is not treated as unmet demand.

**Opportunity score (0–100).** A weighted, normalised blend:

| Feature | Weight | Notes |
| --- | --- | --- |
| Availability gap | 28% | Gap as a share of forecast demand |
| Demand growth | 14% | Last 4 weeks vs previous 4 weeks (normalised within category) |
| Search conversion | 10% | Inverse look-to-book (normalised within category) |
| Margin per unit | 16% | Contribution per unit as a share of sell price |
| Supplier reliability | 10% | Best quote's confirmation history |
| Cancellation resilience | 10% | Lower cancellation risk scores higher |
| Forecast certainty | 12% | Confidence in the demand range |

Growth and conversion are normalised **within each product category**. Transfers structurally grow faster than
cruises and cruises have a much higher look-to-book, so global normalisation would simply rank whole categories rather
than individual opportunities.

**Budget optimiser.** Demand is split into tranches (high-confidence, expected, speculative) using the forecast range.
Each tranche has a sell probability (0.95 / 0.70 / 0.38). Blocks are ranked by expected value per unit of spend:

```
EV per unit = p × margin − (1 − p) × unsold loss
unsold loss = unit cost × flexibility factor   (high 0.35 · medium 0.60 · low 0.95)
```

The risk preset decides which tranches may be committed, and the reserve, access allowance and supplier exposure cap
are applied before any commitment is proposed:

| Profile | Tranches | Reserve | Access pool |
| --- | --- | --- | --- |
| Conservative | High-confidence | 20% | 6% |
| Balanced (default) | High + expected | 15% | 8% |
| Growth | All three | 8% | 10% |

**Governance.** Approve, monitor or reject each recommendation through a confirmation dialog. Approvals are limited to
the Approver and Admin roles and store the owner, role, timestamp and rationale in `localStorage`. Each record is
sealed with SHA-256 and linked to the preceding decision hash; Settings verifies the chain and can export it as CSV.
This is tamper-evident browser storage, not server-side authorization. Production must enforce identity/roles and
retain audit records server-side, linked to contract terms and purchase orders. No action in this app contacts a
supplier or executes a purchase.

## Demo script (about 4 minutes)

1. **Overview** — point out the planning budget, the ₹77 L allocation, the expected downside and the priority list.
   Note that the demand chart switches from solid actuals to a dashed forecast with a confidence band.
2. **Opportunities** — filter to *Hotels*, sort by *Estimated gap*, and open a high-priority week (for example London
   over New Year). Walk through the rationale line by line.
3. **Opportunity detail** — compare suppliers, note the reliability discount on capacity, then **Approve** with a short
   note. The approval banner records the user and time. Nothing is purchased.
4. **Budget optimizer** — switch *Balanced → Conservative* and watch allocation and reserve change; add a category cap
   or swap INR → USD. Then run the optimisation and read the proposed-versus-last-run table.
5. **Recommendations** — approve two pending rows from the queue, then open the **Completed** tab to show realised
   profit and forecast accuracy.
6. **Suppliers / Settings** — show supplier rate history, then the settings page: CSV export, import template, audit
   chain verification and export, role selection, method notes and the reset button.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build
```

Requires Node 18+ (developed on Node 26). The app is a single-page React bundle; all data is generated in the browser
and persisted in `localStorage`. There is no backend, database or Python dependency.

## Deploying

The app uses hash routing (`#/overview`, `#/opportunities/:id`, …), so it works on any static host without rewrite rules.

- **Vercel** — import the repository (framework preset: Vite, build `npm run build`, output `dist`). `vercel.json` is
  already included with CSP, HSTS, referrer, frame, permissions and cross-origin headers. Or run `npx vercel` and
  follow the prompts.
- **Netlify** — build `npm run build`, publish `dist`.
- **GitHub Pages** — build and publish `dist` (set Vite's `base` if the site is served from a sub-path).

No API keys or environment variables are required.

## Data model and CSV import

Opportunity CSV imports require these columns:

```
category,destination,week_start,forecast_units,reliable_supply
```

Optional: `forecast_low`, `forecast_high`, `look_to_book`. Categories are matched by id, name or short name
(`hotel` / `Hotels` / `Hotel`); destinations by id or city. Files are capped at 2 MB and 5,000 rows; numeric values,
dates and planning window are range-checked, and invalid rows are rejected individually and reported in the import
summary. A template is available on the Data & settings page.

All other exports (history, opportunities, suppliers, recommendations, audit log) are CSV with money values in INR.
Spreadsheet-formula prefixes in user-controlled text are neutralised on export.

## Assumptions and limitations

- All data is synthetic and deterministic; it exists to demonstrate the workflow, not to represent real demand.
- Forecast weights, score weights and sell probabilities are transparent starting values, **not** calibrated on TBO
  outcomes. Calibration is the main follow-up before any commercial use.
- Supplier reliability is a single historical ratio; production would use confirmation, fulfilment and cancellation
  history by destination and season.
- Approvals and plan settings live in browser storage, so they are per-browser. The SHA-256 chain detects local
  tampering but cannot replace a server-side identity, authorization or audit system.
- The optimiser is a greedy expected-value heuristic. It respects budget, reserve, supplier and category caps but does
  not solve a global optimum, model supplier volume tiers or handle multi-currency settlement.
- Event lifts come from a small seeded calendar (Diwali, Christmas/New Year, cherry blossom, F1, etc.).

## Security and hardening

This is a browser-only decision-support demo, so the controls below are client-side hardening rather than server-side
authorization. Production must enforce identity, roles and audit retention on the server.

- **Deployment headers** (`vercel.json`): Content-Security-Policy, HSTS, X-Frame-Options: DENY, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, COOP and CORP. A matching CSP meta tag ships in `index.html` so the same policy
  applies on hosts that ignore response headers.
- **Role gating**: Approve/Reject are limited to the Approver and Admin roles (`src/lib/security.ts`), enforced both in
  the UI and in the `decide` path.
- **Session lock**: a privileged session drops to Inventory Analyst after 15 minutes of inactivity, or immediately when
  locked from Settings. Unlocking is explicit.
- **Rate limiting**: decisions (10/min), profile saves (6/min) and CSV imports (5/min) are capped per browser session.
- **Input hardening**: profile names and notes are sanitised; plan settings are clamped to safe ranges; imported CSV
  rows are range-checked; storage reads are size/depth-limited and stripped of prototype-pollution keys.
- **Tamper-evident audit trail**: decisions are sealed with SHA-256 and linked in a chain; Settings verifies the chain.
  A separate, hash-chained security log records locks, role elevations, denied actions, imports, resets and rate-limit
  hits, with CSV export.
- **Output safety**: CSV exports neutralise spreadsheet-formula prefixes; no `dangerouslySetInnerHTML` or `eval` is used.

## Project structure

```
src/
  app/            layout, hash router, page shell
  components/     UI primitives (Card, Button, Badge, Modal, table…) and Recharts wrappers
  data/           categories, destinations, seeded RNG, dataset generators
  lib/            scoring, optimiser, analytics, CSV import/export, date and money helpers
  pages/          Overview, Opportunities, OpportunityDetail, BudgetOptimizer,
                  Recommendations, Suppliers, Settings
  store/          app context: dataset, plan, decisions, toasts, persistence
  types/          shared domain types
```

Stack: React 18 · TypeScript · Vite 5 · Tailwind CSS 3 · Recharts 2 · lucide-react.
