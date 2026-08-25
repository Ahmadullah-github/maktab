# Messaging and Notifications

**Module prefix:** `COM`  
**Current status:** Specified architecture; provider selection pending  
**Primary owners:** School communications staff, module workflows, guardians/employees

## Objective

Reliably send Dari/Persian and Pashto transactional messages, announcements, and notices to guardians and employees through configurable non-SMS and future provider channels, with consent, retries, and delivery tracking.

## Requirements

| ID | Requirement |
|---|---|
| COM-001 | Maintain versioned templates by purpose, language, channel, variables, approval state, and tenant/default ownership. |
| COM-002 | Send to one person, a class's guardians, employees, course groups, or validated recipient segments with permission and preview. |
| COM-003 | Support attendance present/absent/late, fee receipt, arrears, salary approval/payment, school announcement, student diary, and other approved event templates. |
| COM-004 | Select recipient language and eligible contact/channel using verified preferences and consent/policy. |
| COM-005 | Use a transactional outbox so a committed business event is not lost if a provider is unavailable. |
| COM-006 | Keep message intent, recipient snapshot, provider attempts, delivery/read state, and failure reason separately. |
| COM-007 | Provide adapter interfaces for Telegram, push/in-app, and other available providers; no core workflow depends directly on one provider. |
| COM-008 | Retry transient failure with bounded backoff, deduplicate sends, and expose dead-letter/manual resolution. |
| COM-009 | Track sent/delivered/failed/read when supported and clearly label provider limitations. |
| COM-010 | Protect message content, guardian contacts, and recipient lists; avoid confidential detail in lock-screen previews by policy. |
| COM-011 | Allow authorized scheduling, cancellation, throttling, and emergency priority without starving transactional messages. |
| COM-012 | Report delivery by campaign/template/channel/language/status while separating provider cost and school business outcome. |

## Main workflows

### Transactional notification

Business transaction commits → outbox intent with template variables/reference → recipient/consent/language resolution → render snapshot → provider adapter send → record provider ID/status → poll/webhook delivery update → exception/retry. Failure never changes the source attendance/receipt/payroll state.

### Class announcement

Authorized sender chooses class/audience → previews recipient count and both language variants → supplies approved content → sends/schedules → recipient snapshot freezes → background dispatch → delivery dashboard. Changes to class membership after send do not rewrite who was targeted.

## Core entities

`MessageTemplate`, `TemplateVersion`, `CommunicationPreference`, `Consent`, `MessageIntent`, `Campaign`, `RecipientSnapshot`, `OutboxMessage`, `ProviderAccount`, `ProviderDelivery`, `DeliveryAttempt`, `InboundEvent`.

## Invariants and controls

- One idempotency/source-event key cannot send the same transactional message twice unintentionally.
- Provider callbacks are authenticated and idempotent.
- Message logs never contain credentials and minimize sensitive variables.
- Bulk sender permission and audience scope are checked before recipient expansion.
- Contact/provider changes do not alter historical recipient/delivery evidence.
- Marketing/non-essential messages honor opt-out; legally/operationally required notices follow explicit policy.

## Acceptance criteria

- A provider outage creates visible queued/failed status and later recovery without duplicate messages.
- A teacher cannot message guardians outside assigned classes.
- Dari/Pashto templates render correctly RTL with missing-variable validation.
- Delivery status reflects what the provider actually supports and is not falsely reported as read.
- Business screens remain correct even if every notification fails.
- Recipient exports/content are tenant isolated and audited.

## Open questions

- Initial Telegram/push/other provider, account linking, cost, consent, and availability.
- Whether two distinct accounts sharing one Person/contact receive one or separate notifications by context.
- Diary acknowledgement/reply and moderation needs.
- Retention and sensitive-content rules for child/finance messages.

## Implementation tracker

- [ ] Select providers and validate commercial/technical availability
- [ ] Approve consent, language, content, retention, and priority policies
- [ ] Design template/outbox/recipient/delivery model
- [ ] Implement adapter contract and one provider end to end
- [ ] Implement templates, audience preview, bulk/transactional dispatch
- [ ] Add retry, webhook, deduplication, throttling, and reconciliation
- [ ] Integrate attendance, finance, payroll, diary, and announcements
- [ ] Load/security/localization test
- [ ] Pilot and mark Released per channel

