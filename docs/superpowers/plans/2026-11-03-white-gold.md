# White and gold competition dashboard implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, task by task.

**Goal:** Apply the approved design B to the existing application and provide real desktop/mobile screenshots without pushing.

**Architecture:** Keep all domain, hosted persistence and role logic intact. Add a reusable Perspective Tunnel hero, shared presentation utilities and white/gold design tokens. Keep navigation and accessible feedback in the existing client dashboard.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind 4, Framer Motion, Lucide, shadcn-compatible component structure.

**Spec:** `docs/design-preview/README.md`, design B selected by the user.

## Global constraints

- No database, constraint or RLS changes, no credentials in Git, no push.
- Preserve demo storage, login/logout, school_admin and other roles, CSV and print/PDF.
- Reuse existing Thai labels used by forms and regression tests.
- Read installed Next.js documentation before changing framework code.

## Review focus

- Reduced motion must disable parallax and depth travel, without hiding content.
- Wheel/touch scrolling over the hero must still scroll the document.
- Mobile navigation must expose every existing tab with keyboard access and visible focus.
- Loading, success and failure messages must be distinguishable beyond color.
- Print output must include report tables and omit navigation/animated hero.

### Task 1: Hero and UI foundation

Files: package.json/lock, tsconfig.json, components.json, lib/utils.ts, components/ui/button.tsx, components/ui/perspective-tunnel-hero.tsx, components/ui/demo.tsx, public/assets, tests/browser/design.spec.ts.

- [x] Write browser regressions for hero actions, page scrolling and reduced motion, run against current app and observe expected failure.
- [x] Install dependencies, add alias and shadcn-compatible structure, local fonts and sports assets.
- [x] Adapt supplied motion component to design B, container dimensions, ordinary page scrolling, static reduced-motion rendering and optional navigation callbacks.

### Task 2: Apply design across the dashboard

Files: app/page.tsx, app/globals.css, tests/browser/workflow.spec.ts.

- [x] Apply typography/tokens, menus, responsive cards/forms/tables, Lucide icons and score/medal emphasis.
- [x] Add accessible mobile menu, skip link, feedback states and actionable empty state presentation; preserve existing role predicates and write paths.
- [x] Exercise mobile navigation, empty/loading/success/error and print behavior with browser tests.

### Task 3: Validate and deliver

- [x] Run npm test, npm run typecheck, full browser suite and npm run build.
- [x] Inspect desktop/mobile/tablet, keyboard, reduced-motion and print/PDF; capture screenshots from the actual app.
- [x] Review full diff and address important findings. Restore preexisting next-env.d.ts changes after build.
- [x] Leave local changes for user review; do not commit or push.

## Execution record

Implemented inline after the user selected B. Stayed in the existing checkout on a separate design branch; no additional worktree. The user subsequently authorized commit/push together with the registration feature. New tests caught missing hero/navigation, hydration mismatch and a drawer retained across desktop resize; fixes verified. Whole-branch static review found no remaining important issue after the drawer fix. Screenshots and verification details are in `docs/design-review/README.md`.
