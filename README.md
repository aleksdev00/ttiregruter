# TTI Recruiter — new workflow demo

A new, English-only, two-screen recruiting practice app. All contacts, companies, offer conditions and application confirmations are synthetic. No existing TTI application was reused or modified.

This is a single-tab, single-browser-profile demo. It has no production authentication, shared database, multi-device reservation protection, telephony, messaging, real referral or verified application ingestion. Do not enter real driver data. Google Sheets and apply.ttirecruiting.us are not connected.

## Run locally

Use Node 24 (verified here: 24.19.0) and pnpm 11.25.0. From this directory:

```sh
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:5173 for the development application. To run the built application:

```sh
pnpm build
pnpm start
```

Open http://127.0.0.1:8787. Development uses Vinext; the build targets a Cloudflare Worker. App Router source, React, TypeScript and CSS Modules are retained. This runtime adjustment supports the available hosting environment. Pinning and the single pnpm lockfile are included.

## Check the implementation

Run each check separately:

```sh
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

E2E starts the built app on port 8787. Build first. Browser binaries are an explicit prerequisite. For an already running local instance, the test runner reuses it. `DEMO_TEST_URL` can change the test base URL; update the webServer URL as well for a nondefault local port. The published private host is not an E2E target in this execution environment.

Verified versions: Next.js 16.3.4, React 19.2.6, TypeScript 5.9.3, Vinext 1.0.0-beta.5, Vite 8.0.13, Wrangler 4.92.0, Playwright 1.63.0. See package.json and pnpm-lock.yaml for the complete pinned installation.

## Use the demo

The September 30 recruiter playbook replaces the short demo script. All 172 scenarios are clickable from right-side FAQ with source references, coach guidance and explicit temporary center display/return. See [the walkthrough](docs/DEMO_WALKTHROUGH.md).

W-2 skips internal qualification and enters referral readiness; the actual referral is unconfigured. The previous recruiter’s 14-question configuration and answer-driven script are now recovered and connected; qualification requires all confirmed answers, with unknown/review reasons kept distinct. Existing factual history is preserved. Undecided remains an explicit clarification branch. Current carrier offers are fictional, and no verified application receipt or live sending is connected.

See [previous script migration](docs/GUIDE_MIGRATION.md), [implementation and question mapping](docs/PLAYBOOK_IMPLEMENTATION.md) and [actual verification](docs/QA.md). Do not interpret an application report, company selection, URL opening or copying as a confirmed conversion.

## Reset and recovery

The app saves synthetic data under `tti-recruiter:new-demo:v1`. Reset demo data on the dashboard requires confirmation and replaces only this namespace. Corrupted storage is preserved until an explicit reset. Save failures show a retry action; workspace error details use bounded segments. Storage receipts deduplicate mutations. This does not establish server-side concurrency protection.

UTC timestamps are grouped in Europe/Belgrade for reporting. Weeks begin Monday. Daily average covers the previous seven completed calendar days. Callback input uses the browser time zone, displayed in its label; UTC and its time zone are retained.

## Structure and handoff

- `app`: the two App Router routes and demo composition.
- `src/contracts`: repository and future integration boundaries.
- `src/domain`: pure naming, matching, validation and analytics.
- `src/adapters/demo`: synthetic seed, validated snapshot and asynchronous serialized persistence.
- `src/content`: versioned English script and FAQ.
- `src/features`: dashboard and bounded conversation workspace.
- `tests/unit`, `tests/e2e`: behavioral and viewport checks.
- `docs/STATUS.md`, `docs/QA.md`: actual results and open verification work.
- `docs/DEMO_WALKTHROUGH.md`: the five-minute review flow.
- `docs/spec`: the supplied product package.

Lint, typecheck, 25 unit tests and build passed in the execution environment. Browser tests did not execute: Chromium download failed, and the local built server could not start because the environment rejected network interface enumeration. No screenshots or completed browser/zoom/viewport acceptance are claimed. See docs/QA.md. The demo is implemented but is not fully D0-accepted or ready for live recruiting.
