# Owner deployment required: conversation summaries

Inspected source: Library `TTI_Company_Match_P1_P2_Code(1).md`, existing `integrations/google-apps-script/Code.gs` section. Its `doPost` authenticates `webhookSecret`, supports `requestShiftCode`, `completeApplication`, `syncPlacement`, and returns `Unsupported action.` for other actions. `sendCompletionEmail_` explicitly claims a final company/application and `completeApplication_` writes HQ records. Neither is appropriate for general Finish notifications.

The new application's completion service uses a separate versioned contract and will display `blocked` until this handler is deployed. It never falls back to application actions.

1. Open the Apps Script project behind the configured **new application's** HQ_WEBHOOK_URL. Do not edit or redeploy the old TTI application.
2. Add `ConversationCompletion.gs` from this directory as an additional script file.
3. In the existing `doPost(e)`, directly after `verifyWebhookSecret_(payload.webhookSecret);`, insert exactly:

```javascript
if (isConversationCompletionAction_(payload.action))
    return conversationCompletion_(payload);
```

4. Preserve every existing action, Script Property, sheet, and deployment URL. Do not replace the current Code.gs with the mapped-bridge file in this repository.
5. Authorize the existing Script's MailApp permission if Google requests it. Deploy → Manage deployments → edit the deployment matching HQ_WEBHOOK_URL → New version → Deploy. Keep the same URL and secret.
6. In the new TTI application's saved conversation, click **Retry summary email**. If delivery is unconfirmed, click **Check status** instead. Confirm `sent` and then independently check `tticdlrecruiting@gmail.com` for the conversation ID.

Contract: `conversationCompletionCapabilities` is authenticated and sends nothing. `completeConversation` sends only the internal summary. `conversationCompletionStatus` only reads the durable receipt. Every request includes `webhookSecret`; the new application reads this only server-side.

MailApp success means the webhook accepted a send, not confirmed inbox arrival. A durable `sending` reservation is created before the send. Ambiguous outcomes remain `unconfirmed` and must not be reset/deleted casually. Google Apps Script offers no transactional email idempotency API: manual investigation may be required if a process ends after send but before its receipt is persisted. Same-ID retries with different payloads are rejected. Script receipts retain only ID/hash/status/time; frozen full payload lives in the application's database. Monitor Script Properties storage capacity as usage grows; do not delete receipts if corresponding app notifications can still be retried.

No production completion email has been confirmed by implementing this file. Deployment requires owner access to the Script, unavailable in this session.
