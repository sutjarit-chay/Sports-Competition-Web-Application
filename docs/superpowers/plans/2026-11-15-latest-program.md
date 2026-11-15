# Latest Program Import and Date Ordering

User approved all missing competitions and program times, and ordering by date then source match number. Authoritative source: local PDF สูจิบัตรกีฬากลุ่ม 69 12.11.69.pdf, 36 pages; comparison design/audits/2026-11-15-program-comparison.md in primary.

- Preserve all existing school/account/registration/result IDs. Back up live rows privately before mutation. No schema/RLS/constraint changes, secrets committed, or E2E.
- Detailed sport tables take priority over ceremony general schedule: football final17Nov, athletics20Nov09:00onward. Store day + session start/sequence separately from confirmed per-match time; never fabricate 30-minute intervals or all matches at09:00.
- Existing80pairs retained; add4secondarysports18pairs; petanque4divisions pendingdraw; athletics20eventgenderclasscategories frompage14 with41runorder slots101–141 frompages27–28 (row101groupsfourminimarathons).
- Addsource schedule metadata toexistingJSON andrender chronological day groups, sourceNumber1,2,... acrosspools; preservegroup/matrixselection.
- Catalogrun50/primarysubdivisions validated with shared rules; any DB catalog compatibility must be verified before openingquota. No databaseconstraint/RLSalteration.
- Node/API/SQL tests, typecheck, productionbuild, freshreview, safe liveimportreadback, publishmain.
