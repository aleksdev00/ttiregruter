# Current update: previous script restored

At the user’s request, the previous recruiter source was inspected and its actual 14-question configuration recovered. The earlier missing-questionnaire blocker described below is superseded. See [GUIDE_MIGRATION.md](GUIDE_MIGRATION.md) for the current mapping, behavior and checks. Canonical playbook scenarios and their integrity checks are preserved.

# Recruiter playbook integration — September 30, 2026

The existing NEW demo is updated in place. Project: appgprj_6abd258a67b8819181227cfe90580aa8. No older recruiter app, marketing site, external application site, or production driver data is changed. The existing dashboard, ownership namespace, analytics calculation, framework and hosting configuration are retained.

## Connected modules

- `src/content/playbook/source.md`: complete canonical attachment. `data.json` retains all 19 sections, 172 individually addressable scenarios, titles, spoken text, coach instructions, email subject, source slices and references. `scripts/import-playbook.py` reproducibly imports the source and validates IDs and internal references. Integration metadata is separate from source wording.
- `src/content/playbook/engine.ts`: deterministic main-call progression, context resolution, missing-fact fallbacks, verified selected-offer checks, keyword search, suggestions and lossless segments. Section 19 is reference material. S150/S155 are operational actions with no spoken message.
- `Workspace.tsx` and `features/assist`: dominant SAY / COACH / NEXT ACTION controls, right-side clickable FAQ, explicit Show in script / Return to call script, source/coach views, reference sections and paginated call notes. Temporary scenario display does not mutate answers, company or events. The previous step and call segment remain saved; returning focuses the FAQ opener. Escape closes the FAQ.
- `contracts/playbook.ts`, `domain/playbook.ts`, demo repository/validation: compatible existing snapshots, route changes, referral/permission guards, notes, truthful outcomes, driver-reported evidence and immediate synthetic-contact suppression through the existing store. No duplicate contact/application store, runtime LLM or live messaging is introduced.
- `Workspace.module.css`: bounded sections, compact tabs, paginated results and text. Explicit six-row placement from the earlier layout repair is preserved. Rendered acceptance is pending.

## Question mapping and missing approved configuration

The inspected NEW demo had a short demo questionnaire, not the approved 14-question 1099 configuration. The attachment explicitly does not supply those 14 fields. They were not recovered from an older application or invented. `approved1099Questionnaire` explicitly records the missing configuration; qualification completion, internal submission and the company-chosen outcome are blocked until the approved configuration is supplied and integrated.

| Existing NEW-app field | Playbook connection | Treatment |
| --- | --- | --- |
| safeToTalk | Section 2 Open; S007–S010 | Explicit parked/safe answer; driving stops the pitch and routes to callback/outcome. |
| preferredName | Section 1 personalization guidance | Optional name confirmation, clearly identified adaptation. |
| priority | Section 2 Find the reason; S017–S028 | Confirmed driver motivation. |
| nonNegotiables | Section 2 Find the reason; Section 17 notes | Source question and saved factual note; no inferred relaxation. |
| employment | Section 2 Choose the path; S029–S038 | Explicit W-2 / 1099 / undecided choice. |
| homeState, licenseClass, experienceMonths | Section 6 qualification context | Historical demo facts retained; not claimed to be approved 14-question qualification. |
| routePreference, homeTimePreference, startWindow | Sections 8–10 contextual scenarios | Historical demo facts retained and used by the existing matcher. |
| selectedOfferId | Offer discussion and Section 17 company | Stable ID, provisional selection; fictional offers cannot produce verified promises. |
| Approved 1099 Q01–Q14 | Not supplied or present in NEW demo | No exact field/order/type/conditional mapping can honestly be reported. Blocked. |

The five discovery steps are discovery only; their progress is not 1099 completion. Saved historical demo fields remain reviewable separately. W-2 bypasses all internal requirements immediately; switching back to 1099 restores the compatible last internal step and revalidates without deleting facts. Undecided uses S031/S032 and cannot silently select either path.

## Referral, offers and evidence

The existing recruiter referral URL remains null. No attribution parameter or identity is fabricated. W-2 readiness and controls show a configuration blocker. Only an explicitly configured HTTPS destination on apply.ttirecruiting.us can be used; the generic bare URL is not accepted as attributed. Copying, draft preparation, a recorded open action and manually reported sending are separate from application evidence. Permission and parked/safe status guard opening/manual-send logging; no messaging integration sends anything. Browser popup blocking is reported without claiming an open.

All current offers are fictional synthetic fixtures. No live Google Sheet import or approved carrier-term snapshot is connected. Required unresolved placeholders and factual pay/home-time/application claims use S169 instead of raw placeholders or invented facts. The canonical wording and templates remain inspectable in Source mode. Verified-offer use additionally requires the actual selected stable ID and a compatible match.

Driver-reported applying remains unverified and does not increment application counts. Application-started/received outcomes require evidence that this demo cannot ingest, so they are disabled and rejected by the repository. Historical demo confirmation events remain distinct; this change does not create new synthetic completion as a substitute for missing qualification.

Stop-contact invokes the existing synthetic repository suppression and removes the contact from normal availability without deleting history or inventing a call. No downstream queues are integrated; no external cancellation is claimed. Wrong-number records likewise remain saved.

## Actual checks

37 unit tests pass: 172-ID/source SHA/slice integrity, valid references, six mini-dialogues, lossless templates, every ID searchable, representative natural searches, operational channels, missing context, pure scenario viewing, path switching, missing/configured synthetic referral guards, permission, safe-to-talk, note reload, suppression, ownership, matching, retries, failed saves, callback and analytics.

Lint, TypeScript and production build pass. Evidence is in `docs/qa/playbook-*.log`.

Playwright tests were updated for the new flow and four requested sizes: 1280x720, 1366x768, 1440x900 and 1920x1080. The actual runner failed before any test body because the built Wrangler server raises `uv_interface_addresses returned Unknown system error 1`. No browser binary is installed; earlier Chromium installation also failed with an invalid archive. No new screenshots were captured. Keyboard/focus, long-content rendering, popup behavior, actual browser refresh, all four viewport overflow/reachability cases and deployed workflow smoke remain unverified. The intended minimum is 1280x720; it is not a verified supported minimum. These checks remain acceptance work, not passes.

The existing local-storage demo remains single-tab/single-profile. Do not enter real driver data. Approved 14-question configuration, actual attributed referral, verified offers, shared production data, live messaging and verified application ingestion are real outstanding dependencies.
