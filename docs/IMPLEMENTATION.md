# Implementation decisions

Single Next.js client dashboard with separate demo (localStorage) and hosted Supabase persistence. Supabase RLS is the authorization boundary; UI controls only improve usability. No privileged key in browser. Roles are provisioned by a trusted administrator, never self-selected outside demo.

Schools are placeholder records 1–10 pending official names. Competition scope is sport + division + gender + pool. Team events use manually selected pools and round robin, configurable schedules, integer final scores and 3/1/0 standings. Athletics supports timed heats, explicit advancement to finals, ties and non-finishing statuses. Medals are explicit confirmed awards, never inferred from heats. PDFs use browser print styles for Thai text.

Validation: domain unit tests, TypeScript, production build, browser workflow and PDF generation. Live Supabase and authenticated RLS require an actual configured project and identities; SQL verification instructions are included. No deployment is configured before GitHub push.
