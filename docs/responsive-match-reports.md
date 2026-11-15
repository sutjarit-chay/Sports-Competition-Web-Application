# Responsive match reports — 15 November 2569

Scope: match results, set-point entry, result cards and native detail dialog. No backend/data/rules changes.

- Two equal flexible columns for set inputs and totals; inputs may shrink within their labels, with Thai school names wrapping completely.
- Checkbox has an explicit 20px minimum instead of inheriting global 130px input sizing on desktop/tablet.
- Score cards use zero-minimum grid tracks, wrapping headers and compact spacing on small phones.
- Detail dialog fits the viewport, keeps its close header visible while scrolling, supports dynamic viewport height and safe-area padding, and has a 44px close control.
- Per-set table uses fixed column layout and wrapped school names rather than inheriting global nowrap. At 320px, the baseline table scrolled287px inside246px; revised content fits268px inside268px.

Measured with isolated browser fixtures at 320,360,390,768,1024 and1440px: no document/form/dialog horizontal overflow, no table overflow, 20px checkbox, and close target at least44px. Also checked short landscape844x390 and Escape. This is a focused browser layout check, not the full E2E suite. No simulated results were sent to Supabase.

Production Webpack build (including TypeScript) passed. Core Node tests were not repeated for this CSS-only change; no new behavior or score processing was added.
