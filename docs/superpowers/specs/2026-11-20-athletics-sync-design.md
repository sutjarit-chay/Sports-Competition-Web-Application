# Athletics Scoresheet Sync Design

## Intent

Make the athletics page production-buildable and keep its 20-event lane/result data synchronized with Supabase Storage without silently overwriting a newer edit.

## Constraints

- Keep the existing UI, roles, event list, medal projection, and A4 reports.
- Do not change database schema, constraints, or RLS.
- Keep Storage access and cryptographic/versioning code on the server.
- Browser code may import only client-safe types and pure calculations.
- A stale edit must never discard either the latest server document or unrelated fields in the local draft.
- When both devices changed the same field, the value already persisted in the latest Supabase version wins.

## Approach

Use `lib/athletics-scoresheet-model.ts` as the shared client-safe boundary and keep validation and Storage persistence in `lib/athletics-scoresheet-store.ts`. The API remains the only browser-to-Storage write path.

For concurrent edits, keep the rows acknowledged with the current version as the merge base. On `409`, read the latest Supabase document and perform a three-way merge of base, local draft, and latest server rows. A field changed only locally is retained, a field changed only remotely is retained, and a field changed differently on both sides uses the remote value. Derived lane arrays, finalists, and winners are recalculated after merging. Retry the merged draft against the new server version with a finite retry limit.

Alternatives rejected:

- Replacing the whole local draft with the server document loses unrelated work from the current device.
- Retrying the whole local draft as last-writer-wins can overwrite previously saved work from another device.
- Manual conflict dialogs for every collision are unnecessary because the owner selected latest-Supabase-wins for the same field.
