# Athletics Scoresheet Sync Design

## Intent

Make the athletics page production-buildable and keep its 20-event lane/result data synchronized with Supabase Storage without silently overwriting a newer edit.

## Constraints

- Keep the existing UI, roles, event list, medal projection, and A4 reports.
- Do not change database schema, constraints, or RLS.
- Keep Storage access and cryptographic/versioning code on the server.
- Browser code may import only client-safe types and pure calculations.
- A stale edit must reload the latest server document and ask the user to retry; it must not bypass CAS.

## Approach

Use the existing in-progress `lib/athletics-scoresheet-model.ts` extraction as the shared client-safe boundary. Move medal projection into that module, keep validation and Storage persistence in `lib/athletics-scoresheet-store.ts`, and import the shared model from both the component and page. The API remains the only browser-to-Storage write path. This is preferred over bundler aliases or crypto polyfills because it enforces the actual server/client boundary.
