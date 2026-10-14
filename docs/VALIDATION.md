# Validation status — Supabase cutover preparation

## Current changes

- Fourteen owner-created, confirmed Supabase Auth identities match existing recruiter emails exactly. All fourteen are linked in the hosted `recruiter_login_bindings` table: 3 admins, 11 recruiters. No recruiter IDs, roles, aliases, ownership or assignments were changed.
- Three profiles the owner excluded are inactive and unbound. Historical rows are preserved. A recoverable account-setup snapshot was stored before these changes.
- Hosted schema-only login/session/attempt migrations and private JSON helper applied successfully. RLS is enabled on new tables. Anonymous/authenticated roles cannot directly read them; the helper is not callable by those roles.
- Hosted verification after writes: 41,003 drivers, 223 conversations, 31 companies, 46 offers remain. No driver or conversation rows were edited. Auth passwords were entered by the owner; no passwords or tokens were read or committed.
- PostgreSQL adapter uses TLS certificate validation, a small connection pool, no prepared statements, parameterized values, atomic batches and safe integer conversion. It translates the reviewed existing server SQL, including JSON projections/updates and revision guards. An explicitly configured PostgreSQL connection never falls back to Turso on failure.
- `postgres-runtime.test.ts`: 11 tests including nested subtests passed. Synthetic embedded PostgreSQL runs real contact creation, ownership isolation, conversation claim, answers/save/reload, idempotent retry, callback completion, offer projection, admin overview, rollback on stale revisions, JSON array queries, schema readiness and encrypted AuthEngine sessions/logout/24-hour expiry. More than 80 static runtime queries are planned against PostgreSQL. A mocked Supabase provider is used for login tests; these do not prove hosted authentication.
- Full unit suite: 288 tests, 283 passed, 5 failed. Failures are the same pre-existing workbook/catalog expectations and legacy demo-removal fixture documented in the previous release. The new adapter does not change those carrier rules.
- TypeScript and targeted lint passed. Production Next.js build passed.

## Still unverified

Vercel project settings return 403 for the connected scope. The live app's environment variable presence and PostgreSQL network connection are not confirmed. Auth users and bindings are ready, but real browser login/password change/logout and production save/refresh remain deployment acceptance checks. No live recovery email or integration message was sent.

Set server-only `SUPABASE_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `AUTH_SESSION_ENCRYPTION_KEY` on the intended Vercel environment. Preserve existing private Blob and integration configuration. Configure the actual application origin/recovery URL in Supabase Auth; the last observed value was localhost. Reconcile live source edits since the imported snapshot before production cutover. See LOGIN-DEPLOYMENT.md.

Only document metadata was imported. Actual private objects still need storage access verification. Native PostgreSQL backups replace the old SQLite/D1 export path, which is intentionally rejected rather than generating an incomplete export.

## Earlier verified business import

The original snapshot contained 31 business tables and 57,470 rows. Required columns/types and all 31 foreign-key relationships were checked on the hosted project, with no orphan rows. All business tables had RLS enabled and no direct anon/authenticated table access. Auth users were initially absent; the owner has since created the 14 active users above. Snapshot counts can legitimately change after authorized writes (the account setup backup adds a row). `integrations/supabase/verify-import.sql` remains a read-only snapshot completeness check, not a current activity assertion.
