# Athletics Concurrent Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve edits from multiple devices by merging non-overlapping athletics fields and using the latest Supabase value for same-field conflicts.

**Architecture:** Add a pure three-way merge to the client-safe athletics model. The component tracks the rows acknowledged by the current Storage version, rebases its current draft after `409`, then retries through the existing serialized save queue with a finite conflict limit.

**Tech Stack:** TypeScript, React 19, Next.js 16 Route Handlers, Supabase Storage CAS, Node test runner, Playwright

**Spec:** `docs/superpowers/specs/2026-11-20-athletics-sync-design.md`

## Global Constraints

- Do not change database schema, constraints, or RLS.
- Supabase remains the only shared source of truth.
- Latest Supabase value wins when both devices changed the same field.
- Never silently discard unrelated local or remote edits.
- Keep admin/referee/recorder write permissions and viewer read-only behavior.

## Review Focus

- Two devices edit different events: both edits persist.
- Two devices edit different fields of one lane: both edits persist.
- Two devices edit the same field: latest Supabase value wins.
- A newer local edit made during an in-flight request survives the merge.
- Repeated conflicts stop after a finite limit without replacing the visible draft.

---

### Task 1: Pure three-way athletics merge

**Files:**
- Modify: `lib/athletics-scoresheet-model.ts`
- Test: `tests/athletics-scoresheet.test.ts`

**Interfaces:**
- Produces: `mergeConcurrentAthleticsRows(baseRows, localRows, remoteRows): AthleticsRow[]`

- [ ] Add failing unit tests for non-overlapping edits and same-field remote-wins behavior.
- [ ] Run the targeted unit test and confirm it fails because the merge function does not exist.
- [ ] Implement field-level lane merging, lane add/remove handling, derived arrays, finalist synchronization, and winner recalculation.
- [ ] Run targeted and full unit tests.

### Task 2: Rebase and retry the browser save queue

**Files:**
- Modify: `components/athletics-scoresheet.tsx`
- Test: `tests/browser/athletics-scoresheet.spec.ts`

**Interfaces:**
- Consumes: `mergeConcurrentAthleticsRows(...)` from Task 1.

- [ ] Replace the stale-save browser expectation with a failing two-device merge test that checks the second PUT contains remote and unrelated local values.
- [ ] Run the targeted Playwright test and confirm the current replace-on-409 behavior fails.
- [ ] Track acknowledged base rows per version, merge the current draft after `409`, and queue a retry against the latest version.
- [ ] Limit automatic conflict rebases; on exhaustion show an error while preserving the merged visible draft.
- [ ] Run the complete athletics Playwright file.

### Task 3: Verify, document, and deploy

**Files:**
- Modify: `docs/HANDOFF.md`
- Modify: `TODO.md`

- [ ] Run `npm test`, `npm run typecheck`, the athletics Playwright file, and `npm run build -- --webpack`.
- [ ] Update HANDOFF/TODO with the merge rule and real verification results.
- [ ] Commit and push only scoped files; do not include `.env.local`, secrets, or `design/`.
- [ ] Confirm Vercel success and read-only production health.
