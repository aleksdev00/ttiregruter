# Owner FAQ integration

The owner-provided answer bank is integrated into the existing two-page recruiter workspace. Page 1 retains profile, contacts, analytics and referral configuration; Page 2 retains questions, dominant speech, assistance/driver information and company offers.

All 83 Q&A entries and three closing scenarios are reproduced in a source-hashed import. Eight category buttons lead directly to question buttons. Complete speech is displayed in the center; recruiter notes, missing fields and an optional follow-up remain separate. Categories and question lists scroll inside their existing panel; no search, sentence pagination or separate library page is required. Lease questions require a selected, currently verified lease/owner-operator opening, not merely 1099 employment.

Mandatory name confirmation was removed from navigation and progression. Legacy name steps migrate without deleting saved names or guide answers. Optional Driver information correction changes only the preferred name. The opener uses reliable recorded names and filters internal identifiers; unnamed drivers can qualify.

FAQ resolution is pure. Answer context comes from the currently selected offer, confirmed driver answers, agreed notes, and question-specific written facts with provenance, verification dates and expiry. Ambiguous fields such as "policy" cannot borrow another question's terms. Missing facts generate complete, specific verification wording. The Yankee experience example is treated as historical and requires current written eligibility evidence. The source's BBCL/Yankee notes never establish current openings, truck assignments or eligibility.

The owner-approved application destination is https://apply.ttirecruiting.us/. A configured valid attributed referral is preferred without generating parameters. Permission and safety guards remain. For 1099, qualification and company selection precede opening. Interest, one company selection, agreement, link actions and receipt evidence are separate. An unattributed generic link cannot establish an attributed W-2 routed outcome. No external submission receipt or messaging integration was invented.

## Verification

66 unit tests pass. They cover the complete bank/source hash, all placeholder resolutions and fallback responses, carrier switching and expired facts, profile fee policy context, lease gating, historical notes, name migration/correction, identifiers, persistence, 14-item progression/validation, W-2/1099 rules, objections, voicemail, callback/DNC, outcomes and duplicate protection. Lint, typecheck and production build pass. Browser acceptance tests are updated for owner FAQ buttons and all 86 entries; the local browser runner stops before executing test bodies. Cloud-browser validation is reported with delivery.

## Integration gaps

The current application adapter still contains synthetic contacts and fictional offers with browser-local persistence. No real contact backend, current carrier terms feed, verified recruiter attribution, configured callback number, sending service or external application receipt integration is connected. Verified FAQ fact contracts support question-specific written values with provenance and expiry; no live values were inferred from the owner bank. Synthetic terms are never spoken as verified terms. These integrations need their real approved configuration/data; the two-page workflow was updated in place.

## Published browser check

Using synthetic contact DEMO-007 in the existing published app, all 72 non-lease answers and all three closings were clicked and checked for complete speech and zero unresolved brackets. The eight category controls are present; lease content is gated because no verified lease opening is configured. Lease resolution and all 86 entries are covered by unit tests; the lease menu browser test awaits such a configured context.

The unnamed opener did not speak the internal contact ID. Interested/safety led directly to position, employment, state and City/ZIP without a name step. Valid dropdowns advanced and updated counts; a typed City/ZIP draft remained intact after all FAQ interruptions and optional name correction. Confirming City/ZIP and refreshing restored 4/14 progress; negative experience showed inline validation and did not advance, while 24 months advanced to SAP. W-2 immediately skipped internal questions, displayed the owner application URL, and offered copying while opening/manual-send stayed disabled until permission. At the actual 1363×936 viewport, the shell and document measured exactly the viewport with no document overflow. The four exact automated viewport cases remain blocked by Wrangler's `uv_interface_addresses returned Unknown system error 1` startup failure.

A legacy employment-path return could restore an already confirmed employment question. It now resumes the next unanswered question while preserving prior answers; a regression test covers this path. Compact FAQ return now reveals the restored spoken question directly. Dashboard application-link wording and copying use the same approved destination/referral resolver as the call workspace.

Final published path-switch check restored SAP, the next unanswered question, with 5/14 confirmed and previous answers intact. The attached browser screenshot shows the real workspace, full owner FAQ verification speech, separate coaching and missing fields, and reachable return controls. Do Not Contact immediately suppressed the synthetic contact and opened locked explicit outcome review; FAQ persuasion is hidden for suppressed contacts. Final completion/navigation is checked at delivery.

## Simplified call controls

The separate Driver answered step is removed. After starting an attempt, choosing Interested or Not interested records connection evidence once and continues the corresponding branch. Call stage remains separate from attempt/connection evidence. A No answer / voicemail checkbox immediately reveals the complete voicemail in the main script, including in compact mode. Unchecking returns to the opening without recording a connection. If a callback number is not configured, the callback-number sentences are omitted and the missing configuration is shown in coaching; a full voicemail remains available. Leaving voicemail remains a separate reported action. 68 unit tests, lint and typecheck pass; the production build is checked for this release.

Published browser verification with synthetic DEMO-006 confirmed that checking voicemail immediately shows the full voicemail, unchecking restores the opener, and Interested goes directly to qualification without an answered step. Explicit Pending verification completion returned to Page 1. The screenshot in docs/qa/voicemail-browser.jpg records the voicemail view with all controls accessible.
