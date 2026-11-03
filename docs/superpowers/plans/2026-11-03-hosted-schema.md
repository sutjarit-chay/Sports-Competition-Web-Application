# Hosted Supabase compatibility plan

**Goal:** adapt the existing app to the user's normalized Supabase tables without database migration or deployment.
**Architecture:** keep the demo domain/UI and translate hosted reads/writes through a typed adapter. Hosted competitions supply sport/age group/gender and point rules. Registration UUIDs remain UI athlete IDs; school UUID + competition + bib identify race results. Never infer or overwrite ambiguous associations.
**Constraints:** no database changes, live test writes, credentials in Git, or deployment. Existing schema.sql is legacy and must not be rerun on the user's project.

- [x] Test normalized table loading, UUID CSV, configured points, null scores and Thai timezone roundtrips.
- [x] Implement typed hosted adapter; explicit payloads, paginated reads, preserve event metadata and guarded match revision updates.
- [x] Wire UI to real competition options, registration bib, school UUID CSV export and adapter persistence. Keep demo localStorage separate from hosted state, including failed transitions.
- [x] Test hosted UI with an isolated PostgREST test fixture (read and write payloads), retain demo tests. Read-only smoke against the actual Supabase.
- [x] Verify TypeScript/build/tests, review, document actual validation limits, commit and push main. No publication or environment draft update.

Review focus: ambiguous competitions/bibs fail visibly, public results without visible registrations remain displayable, pagination prevents silent truncation, stale revisions fail instead of overwriting, local dates convert to Thailand time consistently. Live RLS/role constraints cannot be inferred from column metadata; use actual error responses and document that authenticated acceptance is still needed.

## Validation

- `npm test`: 15 passed, including stale match revision, ambiguous bib, retained athletics metadata and legacy SQL regressions.
- `npm run typecheck`: passed. Production build completed as part of `npm run test:e2e`.
- `npm run test:e2e`: 7 passed against an isolated hosted API fixture and the existing demo.
- Actual hosted `readHosted` smoke: 10 schools, 8 competitions, 0 matches/races/medals. No live database writes.
- Source review complete; both findings (competition-scoped duplicates and overlapping account transitions) fixed and covered by browser regressions.
- Hosted authenticated RLS and real write constraints remain unverified without a real signed-in test session. No database migration, environment publication or web deployment performed.
