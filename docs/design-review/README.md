# Design B — implementation review

Implemented on `design/white-gold-2569`. The user subsequently authorized pushing the design together with the registration roster feature. Screenshot/PDF files are generated local review artifacts and are excluded from Git.

The screenshots show the actual application with isolated demo data: 10 placeholder schools, 48 sample athletes, 6 matches and sample awards. These records exist only in the capture browser's localStorage. No Supabase records were changed.

## Screenshots

- `desktop-overview.png` / `mobile-overview.png` / `tablet-overview.png`: complete dashboard.
- `desktop-viewport.png` / `mobile-viewport.png` / `tablet-viewport.png`: visible initial screen.
- `*-athletes.png`: athlete registration/table.
- `*-medals.png`: medals and rankings.
- `desktop-print.png` / `medals-demo.pdf`: print layout and sample PDF.

## Verified

- `npm test`: 15 passed, including domain, payload/revision and legacy RLS regressions.
- `npm run typecheck`: passed.
- Production build and full Playwright suite: 15 passed using isolated fixture configuration at port 3100.
- Existing hosted login, school_admin and school registration, CSV, results, athletics, demo persistence and PDF workflows preserved by browser tests.
- New regressions cover hero navigation and ordinary scrolling; initial/dynamic reduced motion; mobile menu, keyboard focus, desktop resize; feedback; print.
- Capture script inspected every existing tab at widths 1440, 820 and 390: no page errors or horizontal document overflow. Tables intentionally scroll within their own containers.
- Static review identified mobile drawer state across viewport changes; fixed and verified with a test observed failing before the fix and passing afterward.
- Text token contrast measured against intended surfaces: body 14.01:1, muted 5.67:1, gold 5.70:1, primary button 8.74:1, error 6.61:1, success 7.15:1. Input border contrast against white 3.52:1. This is not a claim of a complete automated WCAG audit.

Reproduce captures with `npx tsx scripts/capture-design.ts` while the local app is running. `DESIGN_PREVIEW_URL` selects a different local URL. Browser fixtures do not establish that the live hosted project's RLS accepts a particular write; this change does not modify database permissions.
