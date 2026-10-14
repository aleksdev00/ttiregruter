# Live workflow with the private login on Vercel

This checkout contains the current live recruiter workflow with Supabase password authentication. It does not contain a contact export, credentials, or a database backup. Existing workspace storage remains Turso and private Vercel Blob. This change does not migrate workspace records to Supabase PostgreSQL; a separate data adapter and verified cutover are required for that move.

1. Connect the SAME existing Turso database and private Blob store. Do not replace them with an empty database. Set server-only variables in `.env.example`, including `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and a random 32-byte base64url `AUTH_SESSION_ENCRYPTION_KEY`. Never put service credentials in `NEXT_PUBLIC_` variables.
2. Back up Turso before running `pnpm db:migrate:turso`. Migration 0010 adds login bindings, encrypted sessions, attempt limits, and export snapshot tables; it contains no driver records. Existing migration tracking must accurately reflect already applied migrations.
3. Configure Supabase Auth Site URL to the actual HTTPS deployment origin and allow its `/auth/recovery` URL. In the Reset Password email template, use this link:

   `{{ .SiteURL }}/auth/recovery?token_hash={{ .TokenHash }}&type=recovery`

   The server consumes this one-time hash. Do not use a browser-fragment access-token recovery template. Configure and verify Supabase email delivery with an authorized account before claiming recovery works.
4. Set `SUPABASE_SERVICE_ROLE_KEY` only in the trusted provisioning environment. Run `node scripts/provision-private-accounts.mjs` for a read-only dry run, then add `--apply`. The script checks every paginated Auth user and exact existing recruiter email/role. It provisions the approved emails for Alex Jones, John, and Nate Mitchell, preserving their existing IDs, database roles, and assignments. The actual imported database records Alex as admin, John as admin, and Nate as recruiter; the script does not demote an existing administrator. Missing/ambiguous recruiters and binding conflicts stop the script. New passwords are entered in a hidden terminal prompt, never committed; existing passwords are untouched. No invitations, contact writes, or external messages are sent. First use requires a password change.
5. Additional recruiters must be linked by an administrator using the same verified-email/UUID mapping. User metadata never grants a role. Existing source `user_id` values are preserved; `recruiter_login_bindings` is the separate Supabase identity mapping.
6. Publish only after configuration and bindings are ready. Validate login, forced change, logout, reset email/recovery, recruiter data isolation, and a real refresh. The app denies unbound or disabled identities.

The browser receives only an opaque HttpOnly Secure SameSite cookie. Supabase access and refresh tokens remain encrypted on the server. Sessions expire absolutely 24 hours after login; token refresh does not extend this deadline. Recovery sessions last 15 minutes and cannot access the workspace. Password changes revoke all local sessions. Temporary login passwords from older source revisions no longer authenticate this implementation; repository-history cleanup, if required, is a separate operation.

The business import in project `fewcligraztpfsawarbn` has been verified. Supabase Auth currently contains zero users. Live account creation and login have not been verified; Vercel project settings remain inaccessible (403). Unit tests use synthetic identities and do not send emails or access live databases.
