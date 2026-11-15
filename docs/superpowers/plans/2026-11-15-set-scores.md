# Match Set Scores and Result Cards

User explicitly requested visible final scores plus individual set points, and clicking match results to show a detail card. Preserve auth, real data, demo isolation and schema/RLS/constraints.

Design: set-based sports volleyball/takraw capture 2 or3 played sets (best-of-three), validate integer nonnegative points and no tied sets, no trailing sets after winner reached2, and aggregatewinner matching overall score. Do not invent unavailable set scores for existing results. No assumed deuce/third-set caps: organizers' sporting rules remain authoritative.

Store per-match set reports in existing competition.registration_policy.matchReports JSON, anchored to trusted match revision AND exact updated_at stamp to prevent failed/stale concurrent writes being displayed. Stage metadata with management/report-version compare-and-swap retries BEFORE match CAS; decode only metadata matching persisted revision/timestamp/score. Never change schema/RLS/constraints. Preserve all unrelated management, quotas and other matches' reports. Overall-only edits invalidate incompatible old reports.

- [x] Backend pure validation, revision/stamp binding, staged persistence and hosted projection with regression tests.
- [x] Referee result form with optional per-set entry and derived overall scores; existing score-only results remain editable.
- [x] Public/school/referee scoped result cards and accessible native dialog, showing totals/sets/winner/source day/venue/league points as appropriate.
- [x] Integrate home, schedule and result menu; focused isolated demo; full node tests, typecheck/build, fresh review and publish.

No synthetic scores in Supabase. Existing headed demo uses fake environment and intercepted network only. A limited user-requested demo is allowed; do not run full E2E suite.

Review fixes: append-only per-attempt records, durable persisted microsecond allocation, and CAS guards across all policy writers. No real score data changed.
