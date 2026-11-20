# Athletics Scoresheet Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the athletics page with safe Supabase synchronization.

**Architecture:** Pure athletics data and medal calculations live in a client-safe model. Supabase Storage, validation, authorization, and immutable CAS writes remain server-only behind the route handler.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Storage, Node test, Playwright

**Spec:** `docs/superpowers/specs/2026-11-20-athletics-sync-design.md`

## Global Constraints

- No schema, constraint, or RLS changes.
- Preserve all existing athletics data and behavior.
- Never commit secrets or `.env.local`.

## Review Focus

- Client bundle must not reach `node:crypto` through the athletics imports.
- A stale Storage version must not be retried without CAS.
- Viewer remains read-only; admin/referee/recorder retain write access.
- Medal results must remain identical after moving pure calculations.
- Fresh reload must display the saved server version.

---

### Task 1: Enforce the client/server boundary

**Files:**

- Modify: `lib/athletics-scoresheet-model.ts`
- Modify: `lib/athletics-scoresheet-store.ts`
- Modify: `components/athletics-scoresheet.tsx`
- Modify: `app/page.tsx`
- Test: `tests/athletics-scoresheet.test.ts`

- [ ] Use the failing production build as the regression reproduction.
- [ ] Move pure model and medal projection imports to the client-safe module.
- [ ] Run the focused tests, typecheck, and production build.

### Task 2: Make stale synchronization safe

**Files:**

- Modify: `components/athletics-scoresheet.tsx`
- Modify: `tests/browser/athletics-scoresheet.spec.ts`

- [ ] Add a browser test for load, authorized save, conflict refresh, and viewer read-only behavior.
- [ ] Replace the unlocked retry with reload-and-notify behavior.
- [ ] Run the focused browser test and full verification suite.
