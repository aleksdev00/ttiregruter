# Validation — 14 October 2026

- Production Next.js/Vercel build: passed.
- TypeScript: passed.
- Targeted login, crypto/session, libSQL adapter and database export tests: 14 passed, zero failed. Auth tests cover role/identity binding, forced password change, 24-hour absolute expiry through refresh, logout, recovery isolation/expiry, disabled accounts, tampered ciphertext and bounded login attempts. They use synthetic data and a mocked Supabase provider.
- Local production HTTP: login renders; anonymous dashboard/admin/workspace requests redirect to login; identity rejects anonymous access; cross-origin login POST is denied.
- Full unit suite: 270 passed, five failed. The same five failures were independently reproduced in the unchanged current live source: workbook/catalog tests expect older carrier counts, and a legacy demo-removal fixture expects a contact now excluded by availability rules. This update does not claim to fix those existing workflow issues.
- Targeted lint for new authentication routes/components/session engine/tests: passed. Full-project lint still reports errors and warnings in existing workflow and legacy tests; it is not a clean project-wide lint result.
- Migration 0010 was generated against the existing GitHub journal and contains only CREATE TABLE/INDEX statements, no contact imports or mutations of business rows. Code-only historical migration tests now verify that those schema migrations do not provision recruiters, refill queues or create demo records.
- No JWT/refresh token is returned by auth endpoints or rendered into client props. Supabase SDK runs in the server-only authentication wrapper. The browser session uses an opaque HttpOnly Secure SameSite cookie.

## Unverified integration

Real Supabase login, account provisioning, recovery email delivery, role-scoped live data and production Vercel deployment are not verified. At the earlier source push, the connected Supabase scope did not expose the TTI project. This was superseded by the verified project-specific checks below; Vercel project-settings access still returns 403. No unrelated project was changed, no invitations or recovery emails were sent, and no live database was written.

Existing Vercel storage uses Turso/Blob. A Supabase PostgreSQL data import alone is not sufficient for this checkout to read it; database-adapter migration/cutover remains a separate integration task. See LOGIN-DEPLOYMENT.md.

Automatic repository review initially rejected the inherited global demo-seeding operation. The safer revision removes the UI control and all runtime creation paths; the endpoint explicitly denies every role. Historical synthetic builders are isolated under tests/fixtures and only run against in-memory databases. Existing demo cleanup protection is retained.

## Supabase business import — verified against the hosted database

Project `fewcligraztpfsawarbn` was read directly on 14 October 2026 after the owner completed the SQL import. No business records or auth users were written during these checks.

- All 31 source business tables match their snapshot counts: 57,470 rows total.
- Drivers: 41,003. Recruiters: 17. Companies: 31. Offers: 46. Conversations: 223. Completion notifications: 175. Applications: 0. Document metadata: 2.
- All required source columns exist with expected PostgreSQL types.
- All 31 exported foreign-key relationships have zero orphan rows.
- Every source business table has RLS enabled. `anon` and `authenticated` have no direct SELECT access. Auth binding/session tables are also protected.
- Supabase Auth users: 0. Importing recruiter business rows did not create login users.
- The imported approved accounts retain these database roles: Alex Jones admin, John admin, Nate Mitchell recruiter. Provisioning now accepts and preserves the existing valid role instead of requiring an obsolete private role.
- GitHub reports both Vercel deployments for commit cbed93a completed successfully. This confirms deployment, not functional Supabase login or application reads.

The reusable read-only check is `integrations/supabase/verify-import.sql`. Snapshot counts can legitimately differ after business writes begin; this check measures snapshot completeness, not current activity. It does not compare every field byte-for-byte and does not validate document bytes in object storage.

Remaining integration gaps: the application still reads Turso via its SQLite-compatible adapter; Supabase PostgreSQL is not wired into that adapter. The imported `tti_auth_bindings`/`tti_app_sessions` schema differs from the new auth engine's `recruiter_login_*` schema. Account provisioning and storage/database cutover require that mismatch to be resolved and tested. Vercel settings access remains 403 under `pavles-projects-a7c42e44`. No connection password or secret key was requested or committed.

Post-import source checks: the read-only SQL verification ran successfully on the hosted TTI project; TypeScript and 16 targeted auth/provisioning/adapter/export tests passed. No production API calls, account invitations, HQ submissions, emails or contact changes were performed.
