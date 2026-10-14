# Supabase login and PostgreSQL deployment

The current workflow supports Supabase password authentication and the imported Supabase PostgreSQL business database. It preserves recruiter IDs, assignments, names, aliases and database roles. No passwords, tokens, driver exports or private documents belong in Git.

## Applied to the authorized project

Project `fewcligraztpfsawarbn` contains 41,003 drivers, 223 conversations, 31 companies and 46 offers. The owner created the Auth users. Fourteen confirmed Auth identities are linked by exact normalized email in `recruiter_login_bindings`: three admins and eleven recruiters. No roles were inferred from aliases or user metadata. Three profiles explicitly removed by the owner are inactive and have no binding. Their historical records remain. A recoverable `account_setup_backups` record was taken before linking/deactivation. Source Sites applications were not changed.

The schema-only migrations in `integrations/supabase/20261014_login_runtime.sql` and `20261014_json_compat.sql` have been applied. Existing legacy `tti_auth_bindings` / `tti_app_sessions` tables are retained; the current auth engine uses `recruiter_login_*` tables. All fourteen new bindings require an initial password change. These SQL files do not create Auth users or passwords.

## Vercel configuration and release

1. In the intended recruiter's Vercel project, set these **server-only** variables in the target environment:
   - `SUPABASE_DATABASE_URL`: full PostgreSQL Transaction pooler URL from Supabase **Connect**, including the database password. Use the supplied project. URL-encode reserved password characters. This is the database password, not a recruiter password or API key. TLS certificate validation is enforced; prepared statements are disabled for pooler compatibility.
   - `SUPABASE_URL`: `https://fewcligraztpfsawarbn.supabase.co`.
   - `SUPABASE_PUBLISHABLE_KEY`: this project's publishable/anon key.
   - `AUTH_SESSION_ENCRYPTION_KEY`: a cryptographically random 32-byte key encoded as base64url. Generate/store it privately. Retain the same key across deployments; changing it invalidates encrypted sessions.
   - Keep the existing private `BLOB_READ_WRITE_TOKEN` and integration settings unchanged unless separately reviewed. The SQL migration copies document metadata, not private Blob/R2 objects.
2. `SUPABASE_SERVICE_ROLE_KEY` is not required by normal login or the PostgreSQL runtime. Never expose it to the browser. The older `provision-private-accounts.mjs` is a legacy Turso provisioning command for three accounts; do not run it for this cutover or recreate the manually created users.
3. `SUPABASE_DATABASE_URL` takes precedence over Turso. Failed PostgreSQL connections never silently fall back to Turso. Before production cutover, reconcile any edits in the old live database after the imported snapshot. Do not run independent writers against diverging databases.
4. Set Supabase Auth **Site URL** to the approved HTTPS application origin and allow its `/auth/recovery` URL. The last observed dashboard setting was localhost. In the Reset Password email template use:

   `{{ .SiteURL }}/auth/recovery?token_hash={{ .TokenHash }}&type=recovery`

   The server consumes this one-time hash; the browser does not receive an access-token fragment. Email delivery requires a separately authorized test.
5. Push the reviewed commit to the branch connected to the intended Vercel environment. Verify its build and real login, first password change, logout/login, role-scoped contacts and save/refresh before promotion. Compilation alone does not verify connectivity or login.

The browser receives only an opaque HttpOnly Secure SameSite cookie. Supabase tokens stay encrypted in the server database. Login expires absolutely after 24 hours; refresh does not extend the deadline. Recovery lasts 15 minutes and cannot access the workspace. Password changes revoke local sessions. Disabled/unbound identities are denied.

## Operational limits

Vercel project-settings access currently returns 403, so environment presence and live connectivity cannot be confirmed here. Storage objects and external deliveries are not verified by SQL import. SQLite/D1 export SQL is intentionally rejected on PostgreSQL; use native PostgreSQL backups. Verification triggered no live emails, application submissions or Quo actions.
