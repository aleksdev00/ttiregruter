# TTI Recruiter — private Vercel test app

This repository is the isolated private test app. It does not modify or deploy the main TTI Recruiter application. It uses Next.js on Vercel's Node.js runtime, a Turso/libSQL SQLite-compatible database, and private Vercel Blob storage for documents and recoverable backups.

## Connect and deploy on Vercel

1. Import `aleksdev00/ttiregruter` into Vercel and keep the repository private.
2. Add Turso Cloud from the Vercel Marketplace and connect it to this project. Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to Development, Preview, and Production as needed.
3. In Vercel Storage, create a **private** Blob store and connect it to this project. Vercel supplies the Blob credentials. Do not create a public store; driver documents and migration backups are private.
4. Configure the server-only environment values listed in `.env.example`. Keep `HQ_TRANSFER_ENABLED`, `HQ_MAPPING_VERIFIED`, and `HQ_NOTIFICATION_AUTHORIZED` disabled until the owner verifies the webhook contract and mapping.
5. Run the schema migration once against the connected Turso database: `pnpm db:migrate:turso`. Then deploy from `main`.

Vercel's environment variables are read at server runtime. Never prefix webhook keys, database tokens, or Blob credentials with `NEXT_PUBLIC_`.

The app currently seeds its private test accounts, approved company catalog, and 500 synthetic test contacts for the owner when the owner first signs in to a fresh database. Other test accounts are created on their first sign-in. Initial accounts must change their password. Do not add real driver data to this private test deployment unless the owner has separately approved it.

## Existing Cloudflare data

This migration changes the app runtime and storage adapter. It does **not** export data from the previous Cloudflare D1 or R2 environment. The Vercel database starts fresh after schema migration; the previous database remains untouched. Before using Vercel as the working app, separately review whether any private test records or documents need a controlled export/import. Do not point Vercel at production data by copying credentials into source code.

## Local development

Use Node.js 22.13 or newer and pnpm 11.25.0:

```sh
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env.local
# Fill in local Turso and private Blob credentials in .env.local.
pnpm db:migrate:turso
pnpm dev
```

Open http://localhost:5173. To verify a production build locally, run `pnpm build` then `pnpm start`; it serves on port 3000.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm test:e2e
```

The API routes use Node.js runtime and are forced dynamic so private cookies and database access are evaluated per request. Document bytes upload directly from the authenticated browser to a **private** Blob store, avoiding Vercel Function request-body limits. The upload token is issued only after server-side recruiter access checks; the completed upload is recorded durably in the database.

## Important integration limits

- HQ webhook delivery is disabled until its server-side environment settings and mapping are checked.
- Quo ingestion remains disabled until its signed webhook key and event version are configured.
- Vercel import/build does not itself provision database/blob stores or copy old D1 records.
- This is a private test app, separate from the main app and `ttirecruiting.us` production domain.
