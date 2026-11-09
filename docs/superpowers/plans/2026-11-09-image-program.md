# Image Program 2569 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Import exactly the eight competitions and eighty fixtures shown in the two user screenshots; remove only backed-up legacy simulated competition data.

**Architecture:** Store source numbers, groups, fixture phases and unresolved qualification labels in existing competition JSON management. Preserve real school/account IDs, store no fictional match timestamps, and materialize only known participants with a supplied venue/time. Group qualifiers are explicitly selected by the administrator; match winners/losers derive from confirmed results.

**Tech Stack:** Existing Next.js/TypeScript/Supabase SDK; existing private Storage and registration policies.

**Spec:** User confirmations: use screenshots for categories/teams/brackets; athletics one school representative per individual event with sex/age table pending; delete simulated old competition data; schedule/venue/referees supplied later.

## Constraints

- No schema, constraints or RLS changes. No E2E per user instruction.
- Preserve all school accounts and registration-rule caps; no invented reserve quotas.
- Do not create athletics divisions, petanque or secondary volleyball absent from the screenshots.
- Back up the legacy competition and its simulated registration privately before deletion.
- Keep qualifying slots unresolved when the organizer's tie-break rules are not supplied.

## Tasks

- [x] Transcribe public source data into data/competition-program-2569.json; test eight types, group memberships, fixture counts/source numbers, winner/loser references and athletics pending quota.
- [x] TDD phase-aware draw validation, trusted loser propagation, pending qualification safety, and admin qualification confirmation; prevent premature medals and preserve existing format behavior.
- [x] Provision canonical competitions and image brackets with real school UUIDs; verify all eighty fixtures; archive then delete only the known legacy simulated competition/registration.
- [x] Run node tests, typecheck and production build; fresh review; publish main using existing authorization. Do not run E2E.

## Ledger

- Base22f3218; feature worktree /private/tmp/nkg-image-program.
- Phase metadata is necessary because applying the old competition-wide knockout rule would incorrectly reject group-stage draws.
- Athletics waits for the user's sex/age table. Individual quota1 per school/event does not mean a per-athlete one-event limit or one runner for an entire relay team.
