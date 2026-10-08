# Previous TTI Recruiter script behavior restored

The user explicitly requested inspection of the last TTI Recruiter and implementation of how its script worked in the NEW demo. Read-only reference: `/workspace/scratch/a55b9b851487/tti-live-deploy-20260929/public/legacy/app.js`, source commit `0a5bfe719e4a1a6f460c5574a8b73534abbb5a6c`. The older application and its production systems were not changed.

The reference uses confirmed answers for this call, finds the next unanswered question, acknowledges the previous answer and renders the whole current question. Explicit select changes advance; typed drafts require confirmation. Handled/confirmed answers stay saved; answered questions can be reviewed. W-2 bypasses internal questions. These mechanics are now connected through the existing NEW demo repository and conversation state, rather than loading the legacy DOM script or creating another contact store.

The exact 14 IDs, question order, input kinds, select options and English prompts are preserved in `src/content/playbook/previous-guide.json`. `src/domain/guide.ts` implements validation, next question, progress, acknowledgments and conservative projections into the existing matcher. The source version is recorded in that content file. `GuideAnswer.tsx` provides the current answer and explicit review reason; Workspace renders the corresponding line and restores call state after FAQ preview. `saveGuideAnswer` saves and advances atomically, audits the action, clears downstream company selection on changed qualification and retains answers through pause/reload/path switches.

| Order | Source ID | Input | Question context |
| --- | --- | --- | --- |
| 1 | position | Select | Company driver / Lease / Owner-operator |
| 2 | employmentType | Select | W-2 / 1099 / Either |
| 3 | state | Select | State of residence |
| 4 | locationZip | Text | City and ZIP |
| 5 | experienceMonths | Whole-month number | Recent verifiable Class A experience |
| 6 | sap | Select | SAP / RTD status |
| 7 | trailer | Select | Trailer equipment |
| 8 | truck | Select | Truck preference |
| 9 | route | Select | OTR / Regional / Local / Dedicated |
| 10 | home | Select | Home time / days out |
| 11 | payTarget | Text | Weekly pay target and gross/net basis |
| 12 | availability | Text | Timing / notice |
| 13 | priority | Text | Main priority |
| 14 | dealbreakers | Text | Firm limits |

The NEW playbook's opening, motivation and explicit employment discovery remain. A 1099 choice already explicitly confirms employmentType for this call; qualification continues at position and follows the recovered order, skipping only already-confirmed answers. Existing stored facts are not silently confirmed. Unknown/flexible answers require an explanation, remain separate from confirmed facts and do not satisfy completion. SAP “not confirmed” likewise blocks completion. W-2 switches immediately to the current playbook's external referral handoff; no internal field completion is required, fabricated or counted. Returning to 1099 restores the last compatible step and confirmed facts.

Preserved source behavior is adapted to the NEW app's truthfulness requirements: selecting Lease/Owner-operator does not silently select 1099; an undecided employment answer requires explicit clarification. A clear refusal still ends the pitch. An acknowledgment does not promise hiring, matching availability or a particular schedule. Whole questions now fit the main script's larger segment budget; canonical scenarios remain unchanged. Required/preferred carrier matching from the legacy app is not imported into fictional NEW-demo offers that lack those criteria. Dedicated routes and multiweek home-time answers remain unknown to the narrower demo matcher rather than being relaxed to “any.”

Qualification completion means 14 actual recorded confirmations, not carrier eligibility approval or application receipt. Offers remain fictional/unverified and live internal submission is still not integrated. The real referral remains unconfigured. No external outreach or application was executed.

## Actual verification

42 unit tests pass, including the recovered ordered 14-question configuration, full-prompt rendering, confirmation-driven advancement through all questions, persistence, review/unknown gating, W-2 bypass and exact return step, changed-answer selection invalidation, canonical 172-scenario integrity and existing repository/analytics regressions. Lint, TypeScript and production build are checked for this source. Guide-prefixed logs in docs/qa record this update.

Browser acceptance remains blocked by the managed Wrangler runtime's `uv_interface_addresses` startup error, before any Playwright test body. No fresh screenshots or rendered no-overflow claims are made. Four viewport cases remain pending in the authored browser suite. The intended minimum remains 1280x720, pending rendered verification.
