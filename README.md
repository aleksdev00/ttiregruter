# TTI Recruiter on Vercel

Current live recruiter workflow with the approved private password login, backed by Supabase Auth. The existing Vercel storage adapters use Turso/libSQL and private Vercel Blob. No contact database, exports, secrets, or initial passwords are included.

See [login deployment and account provisioning](docs/LOGIN-DEPLOYMENT.md) before deploying. This includes the required server variables, the Supabase recovery email template, and the dry-run account provisioning command. Auth accounts must be linked to verified existing recruiter emails; contact assignments and analytics retain their original IDs.

## Development

Use Node.js 22.13+ and pnpm 11.25.0. Run `pnpm install --frozen-lockfile`, configure server variables from `.env.example`, and use `pnpm dev`. Production uses `pnpm build` and `pnpm start`.

Checks: `pnpm typecheck`, `pnpm test:unit`, `pnpm build`, and `pnpm lint`. Unit tests use synthetic fixtures. Browser/live login checks require configured database and Supabase accounts.

No private demo account or synthetic-contact bootstrap runs on login. This source update does not migrate the workspace database to Supabase PostgreSQL and does not modify the existing ChatGPT Sites deployment. The Apps Script source is preserved for the live completion payload, but this operation does not change its remote deployment or send any messages.
