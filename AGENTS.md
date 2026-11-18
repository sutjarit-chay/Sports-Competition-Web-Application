<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Instructions & Agent Guidelines

### Mandatory Updates on Code Changes
Whenever code or database logic is modified or new features are added:
1. **Update HandOff (`docs/HANDOFF.md`)**: Keep the current progress, latest changes, and context updated so any developer or agent can resume work seamlessly.
2. **Update TODO (`TODO.md`)**: Mark completed tasks as `[x]` and list any new pending tasks or technical debt under pending tasks.
3. **Update Schema (`docs/SCHEMA.md`)**: If database columns, constraints, RLS, Storage, or JSON structures (such as `registration_policy` or `roster_details`) are added or changed, reflect them immediately in `docs/SCHEMA.md`.

