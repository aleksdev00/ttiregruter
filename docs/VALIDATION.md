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

Real Supabase login, account provisioning, recovery email delivery, role-scoped live data and production Vercel deployment are not verified. The connected Supabase scope has no TTI project; access to the known Vercel project returned 403 under scope `dev-aleks`. No unrelated project was changed, no invitations or recovery emails were sent, and no live database was written.

Existing Vercel storage uses Turso/Blob. A Supabase PostgreSQL data import alone is not sufficient for this checkout to read it; database-adapter migration/cutover remains a separate integration task. See LOGIN-DEPLOYMENT.md.

Automatic repository review initially rejected the inherited global demo-seeding operation. The safer revision removes the UI control and all runtime creation paths; the endpoint explicitly denies every role. Historical synthetic builders are isolated under tests/fixtures and only run against in-memory databases. Existing demo cleanup protection is retained.
