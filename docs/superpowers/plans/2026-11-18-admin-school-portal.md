# Administrator school portal plan

User approved administrators managing school information, logo, type, contacts/address, athletes and coaches on behalf of any school. Reuse SchoolPortal and existing admin-authorized APIs. No school identity changes, account relinking, score writes, schema/RLS changes or secret files.

- [x] Keep the selected school pinned in modal state across refresh and reset selection on authentication changes.
- [x] Reuse existing profile/roster forms inside a controlled native admin-only modal opened from each school row. The header identifies the school; profile/roster tabs and component keys reset private drafts between scopes.
- [x] Replace inline rename with a modal edit button in AdminSchoolManager; display logo/type and preserve school deletion safeguards.
- [x] Notify parent of portal saves so school switching is disabled during an in-flight profile/staff save. Reuse existing roster quota validation and CAS/version checks.
- [x] Verify admin cross-school profile/coaches API permissions, Node suite, TypeScript, build, and focused mocked browser flows (rename, logo/type/contact, switch school, athlete/coach management). No production writes.
- [x] Fresh code review; mounted-save callback blocker fixed and re-reviewed.
- [ ] Publish tested tree and verify deployment; preserve local files.

User steering: all editing must open in a modal with save buttons, rather than separate admin pages/dropdowns. Logo public URLs include the immutable profile version so replacements refresh throughout the UI.

Verification: 270 Node tests passed. Four focused browser tests passed: desktop/mobile profile + logo + type + contacts + athlete/coach editing, private school context isolation, partial-name-save retry, busy dismissal guard, stale response across authentication refresh, and existing mobile account reassignment regression. TypeScript/production build passed. No production writes.
