# Administrator maintenance tools

Approved scope: the user selected clearing athletes, coaches, schedules, results and medals, while retaining schools, accounts and sport registration rules.

Administrators get school rename/delete controls, a school/referee account directory with editable usernames and a new-password action, and a new-competition reset preview/confirmation. Existing passwords cannot be retrieved and are never stored in metadata, exports or logs.

School deletion is restricted to schools without linked accounts, registrations, fixtures, results, medals, files or bracket references. Linked accounts can be reassigned to another existing school first; deleting a school must not silently delete accounts or competition history.

Reset preserves school profiles/logos, Auth users, profiles, signup requests, competition identity and sport/quota policies. It clears registrations, coaches (all versions), team-file records/files, matches, athletics events/results, medals and management teams/fixtures. Every reset requires a fresh counts preview, a typed confirmation and a private backup before the first deletion. Archive data stays private and recoverable for administrators. Failed or interrupted work is reported honestly and can resume; a failure to back up blocks deletion.

Use authenticated Next route handlers and existing Supabase tables/private Storage. Check actual admin profiles on every request. No schema, constraint or RLS changes; no live data deletion during implementation/testing. Guard competition writes during reset and preserve changed/new records rather than deleting anything that was not backed up.

Approaches: result-only clearing was considered; the user selected a full competition-data reset. Retaining identities/rules avoids recreating approved accounts. Password reset is used because plaintext password viewing is not supported by Supabase.
