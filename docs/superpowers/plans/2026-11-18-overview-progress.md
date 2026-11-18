# Overview competition progress implementation plan

> Execute inline with superpowers:executing-plans. User approved the table design in chat.

**Goal:** Show all-work competition progress on Overview: competition, total slots, completed/recorded slots, remaining slots, next slot.
**Architecture:** A pure read-only projection merges programme fixtures with persisted matches. A responsive table consumes it; no schema, RLS, account, score or policy writes. Athletics counts distinct heat/round slots with saved results, explicitly described as recorded rather than confirmed complete.
**Tech Stack:** Existing Next.js / React / TypeScript / CSS.

## Agreed design and constraints

- One row per competition including sex/level; Thai dictionary name order.
- Team totals include programme slots awaiting qualifiers; persisted legacy matches included once.
- Team completed means finished/legacy confirmed only. Next = first unfinished by Bangkok date then source number, with qualifier labels when unresolved.
- Pending draw / no slots uses unknown counts and a clear pending notice, not invented zero-total completion.
- Athletics merges programme slots and actual events by competition + round + heat, counts unique event slots with valid result records, and never counts athlete rows as heats. If multiple event definitions make a match ambiguous, show unknown counts and disclose the duplicate heat definitions.
- Loading, read error, empty and complete states; keyboard-accessible horizontal scroll on mobile and full school names.
- Keep real scores, registrations, secrets, schema and RLS unchanged. No full E2E suite; focused mock-browser checks only.

## Tasks

- [x] Add failing projection tests for legacy/managed fixtures, source order, completed/next, pending draw, athletics result deduplication and source/actual merging.
- [x] Implement lib/competition-progress.ts and components/competition-progress.tsx with accessible table + CSS.
- [x] Integrate immediately below Overview hero for all roles with existing snapshot and loading/error state.
- [x] Verify Node suite, TypeScript, production build, and focused browser test at desktop/mobile with intercepted fixture data.
- [x] Review all changed files.
- [ ] Publish exact tested tree to main, verify Vercel deployment and keep local generated files intact.

## Verification before publish

261 Node tests passed; TypeScript passed; production build passed; desktop 1365px and mobile 390px fixture browser checks passed. Fresh review findings were fixed and re-reviewed. Read-only hosted projection returned 36 competition rows, 98 known team slots with 93 finished, 44 athletics slots, and 4 pending draws. No production writes.
