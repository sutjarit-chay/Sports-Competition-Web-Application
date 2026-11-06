# Administrator Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Provide real administrator school/account maintenance and an explicitly confirmed, backed-up competition reset.

**Architecture:** Authenticated server handlers verify the actual admin profile and use narrow service operations. UI components are mounted only in the administrator account tab. Existing normalized records and private Storage are retained; reset is resumable and never claims transactional atomicity across REST requests.

**Tech Stack:** Next.js 16.4.4, React, TypeScript, Supabase SDK, existing private team-files Storage, node:test and Playwright.

**Spec:** `docs/superpowers/specs/2026-11-06-admin-tools-design.md`

## Global Constraints

- No schema, constraint or RLS changes; no credentials in Git.
- No real competition reset or real password/account changes while testing.
- Retain school/account/rule identities during reset.
- Passwords are set anew and never returned by a directory API, logged or backed up.
- Follow installed Next route-handler documentation before editing handlers.

## Review Focus

- Non-admin and forged-role requests must produce no privileged writes.
- Username collisions, admin targets and legacy identities cannot be overwritten.
- Backup failure and interruption must never look like a completed reset.
- Concurrent changes must invalidate previews or preserve unbacked-up records.
- School references in Storage/JSON are dependencies as well as SQL foreign keys.

### Task 1: Account and school administration

Files: `lib/admin-accounts.ts`, `app/api/admin-accounts/route.ts`, `lib/admin-schools.ts`, `app/api/admin-schools/route.ts`, `tests/admin-accounts.test.ts`, `tests/admin-schools.test.ts`.

Interfaces: account GET returns safe school/referee account summaries; PATCH actions username/password/school change exactly one concern. School GET preview returns dependency counts; DELETE requires typed school-name confirmation and an unchanged preview, and rejects every referenced school.

- [x] Write failing SDK HTTP-fixture tests for authorization, collisions, admin protection, password non-disclosure, school reassignment and school dependency refusal.
- [x] Run focused tests red, implement narrow handlers, rerun green.

### Task 2: Backed-up competition reset

Files: `lib/competition-reset.ts`, `app/api/competition-reset/route.ts`, `tests/competition-reset.test.ts`.

Interfaces: GET returns reset preview/counts/current-job status; POST preview/start/step actions return current resumable state and backup manifest references. Export `assertCompetitionOpen(client)` for server mutations. The UI follows the returned job until complete or an explicit error.

- [x] Write failing tests for exact reset scope, preview changes, typed confirmation, backup failure, partial failure/resume, repeated requests and retention of users/schools/policies.
- [x] Implement private bounded backup parts and manifest, an exclusive reset claim, conditional deletion of backed-up records only, safe metadata clearing and observable progress.
- [x] Run focused tests green, including retained concurrent changes and failed-backup/no-deletion assertions.

### Task 3: UI and write-path integration

Files: `components/admin-maintenance.tsx`, `components/admin-account-manager.tsx`, `components/admin-school-manager.tsx`, `app/page.tsx`, relevant mutation handlers, and registration server handler if required to enforce reset maintenance.

- [x] Add role denial and interaction/persistence browser cases before implementation.
- [x] Render responsive school edits/dependency-aware deletion, safe account actions and reset preview/confirmation/progress/download controls.
- [x] Guard competition writes during reset; reload real snapshots after mutations and errors.

### Task 4: Verification and delivery

- [x] Run `npm test`, `npm run typecheck`, full Playwright E2E and `npm run build -- --webpack`.
- [x] Obtain a fresh read-only whole-change review, fix important findings with regression tests.
- [ ] Delivery checkpoint: scan changes for secrets and SQL/RLS changes, integrate/push main using existing authorization and verify deployment status (final result recorded in task response).

## Execution ledger

- Base `300fd39`; isolated worktree `/private/tmp/nkg-admin-tools`, branch `feat/admin-tools`.
- Ruling: preserve school accounts when deleting schools; referenced schools require reassignment/cleanup first, because silent cascading deletion was not requested.
- Ruling: implementation and tests do not execute reset against the live project. User confirmation in the delivered UI is the destructive-action boundary.

- Verification: baseline113passed; final146unit/SQL/APItests and36PlaywrightE2Etests passed.
- Review: fixed resetrelease/step and staleclaimcleanup races withterminalstate +CAScleanup leases. ReservedStorage namespaces are excluded from reset; independent re-review found no remaining important cleanup issue.
- Delivery verification and deployment status are recorded in the task response. No live reset/password/school deletion was performed.
