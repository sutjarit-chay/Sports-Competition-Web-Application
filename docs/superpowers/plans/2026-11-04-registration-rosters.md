# Competition registrations and roster limits

**Goal:** Implement the user's supplied sports, roster slots, quotas, athletics choices and shared summaries without deleting existing registrations.

**Decisions:** Limits apply per school and competition (sport/gender/level). Unspecified levels/genders are taken from the competition, not invented. Partial registrations remain allowed; caps are enforced, not minimum full-team submission. Unknown organizer reserves/individual quotas must be configured before those slots/events can be registered. Existing rows retain unknown position and count against the overall cap. Existing unmatched competitions remain visible as legacy data.

**Architecture:** One JSON catalog consumed by TypeScript and a generated additive SQL migration. Add nullable `competitions.registration_policy` and `registrations.roster_details`; keep all existing IDs, RLS and constraints. A trigger validates configured competitions, concurrent writes and direct API inserts. UI and CSV use the same domain validator. Local demo configuration remains separate from hosted configuration.

- [x] Write domain/SQL regressions first, including every supplied cap, legacy rows, CSV, unknown quotas, multi-event athletics and relay limits.
- [x] Implement catalog, domain validation and backwards-compatible hosted extension reads/writes.
- [x] Implement catalog table, dynamic roster form, admin configuration and summary; retain old unmatched records and label them explicitly.
- [x] Generate/test the additive migration on an isolated normalized PostgreSQL fixture; do not apply to a live schema without verified administrative access.
- [x] Run complete tests, browser workflows, typecheck and build; review final diff. The user skipped final screenshot capture; existing browser PDF regressions pass.
- [x] Document changed files/data/validation/tests and exact legacy review needs. User subsequently authorized pushing to main.

**Verification boundary:** Workspace contains only the legacy SQL schema, not the live normalized schema's full DDL. The migration therefore has a normalized-schema preflight and is delivered as a reviewable artifact. Live application requires administrator execution. No privileged database connection is available in this session; the Supabase integration was discovered and suggested and is awaiting installation/connection. Running migration on the live project remains pending that connection.
