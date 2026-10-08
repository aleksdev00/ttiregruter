# Owner recruiter script Version 2

Authoritative inputs: TTI_Recruiter_Implementation_Prompt_EN(1).txt and TTI_Recruiter_Script_EN (1).docx, Version 2, October 4, 2026. Current source opened at 1ad6f219b04ecad893a54c2f659e48103d43ce80, published Site version 72 before this change. Only the new recruiter project is changed.

## Implemented

- B01–B10, O01–O40 and T01–T06 extracted by stable identifier. Source wording, separate coaching, recording instructions, follow-through and source references are retained in version2.json. Known S IDs redirect to the approved new blocks; canonical source.md/data.json are regenerated consistently.
- Recorded contact name and professional alias provide one short opener; missing names use a neutral introduction. Optional corrections persist the corrected contact name while retaining original-name provenance.
- All active physical-situation/device checks and routing dependencies removed. The old nullable property is read-compatible and is not used as a prerequisite.
- W-2 company drivers use the short permission-based configured referral path. No unverified opening count or response-time promise. Lease/owner-operator precedence and saved answers are preserved.
- Internal path collects priority, deal-breakers, home base, route, home schedule, trailer, experience, separate incident notes, SAP and start timing one question at a time. Unknown/declined/review answers require reasons. Original 14 IDs and nine-field application gate remain; optional truck/pay preferences and other early preferences do not become application prerequisites.
- Incidents are stored separately from SAP with corrected type/date notes. Home field retains days out; material days-at-home requirements remain in notes.
- Spoken summary and comparison use known facts and at most two compatible current verified offers. Provisional catalog entries retain review labels; urgency does not override hard restrictions. Selecting a company opens comparison, then a distinct application next step.
- One permission probe for a mild refusal; repeated refusal ends the pitch. Busy opening, wrong-number, voicemail and immediate DNC have distinct controls and evidence.
- All original FAQ categories remain, with lease content limited to its applicable context. All 40 new situations and six manual message drafts are accessible by clicking within the existing right panel. Full responses scroll instead of sentence pagination. Preview/return never mutates progress or answers.
- Manual drafts do not send, submit, or record a send. Missing facts generate complete fallback wording and separate verification fields. Offer-scoped facts cannot carry over to another selection.
- Outcome review reports actual intent, recorded external receipt and local/LiveHQ application delivery separately; it does not use the generic unexpected-question response. The existing explicit submission, retry, idempotency and separate all-outcome owner summary remain.
- Callback time is interpreted in the explicitly recorded driver's IANA zone. Invalid zones and ambiguous/nonexistent DST times are rejected. Callback zone is retained in the owner summary.
- Approved two-page layout, durable contacts, assignments, access roles, analytics, catalog and runtime bindings preserved.

## Validation

231 unit/regression checks pass, including server SQLite workflow/delivery mocks, account ownership, repeated submission protection, failed/uncertain delivery, all-outcome owner summary, immediate DNC, refresh persistence, SAP/urgent exclusions, local/home restrictions, zero/one/two offer comparison, all 56 blocks and 172 legacy responses without unresolved spoken placeholders, exact resumption, incident dates, callbacks and manual drafts. TypeScript check passes. Production build and whitespace check are required before publication.

Browser QA is unavailable in this managed environment because the required control-browser capability is not installed. No browser/viewport or signed-in live call verification is claimed. No application, completion summary, email or message was sent to a real driver or mailbox for testing.

## Facts still requiring the owner or carrier

Current opening/rate/basis, benefits, carrier eligibility and special conditions must be verified in the appropriate offer context. The approved driver-facing document channel and specific agreed follow-up must be supplied before their wording can be resolved; the app retains safe fallbacks when absent. Existing document upload and application gates are preserved; requested/promised documents are not marked received. External W-2 receipt integration remains independently unverified unless an actual receipt record exists. LiveHQ and owner-summary connectivity/inbox receipt are not re-certified by mock tests or publication.
