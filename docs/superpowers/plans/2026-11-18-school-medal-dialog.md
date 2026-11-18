# School medal details implementation plan

User approved: click any school medal row to open a modal listing competition, level, gender, medal. Use exactly the same calculated awards as table totals; gold/silver/bronze then Thai dictionary order; desktop/mobile, native keyboard button and Escape dismissal. No athletes or coaches requested. No schema/RLS/data/secret changes.

- [x] Add pure detail projection tests: scope by school, preserve competition/event identity, ordering and exact medal totals.
- [x] Add shared clickable medal standings and native dialog components, using existing dialog styling and focus/backdrop behavior.
- [x] Integrate overview medal summary, combined medal table and category tables using existing visibleAwards only. Preserve school-role scope.
- [x] Verify full Node suite, TypeScript, build and focused fixture browser interaction at desktop/mobile; no production score writes.
- [x] Review changes.
- [ ] Publish exact tested tree, verify Vercel deployment and preserve local files.

Verification: 266 Node tests passed. Focused desktop 1365px/mobile 390px browser checks passed for full-row click, exact medal totals, sorted event detail, keyboard open, Escape/close/backdrop dismissal, immediate reopen, focus return, centering and no horizontal overflow. TypeScript and production build passed. Fresh code review had no remaining blockers. No production writes.
