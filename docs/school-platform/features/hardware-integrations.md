# Hardware and External Integrations

**Module prefix:** `INT`  
**Current status:** Architecture specified; vendor selection pending  
**Primary owners:** Platform integrations, field support, school IT/operator

## Objective

Integrate affordable biometric devices and standard printers reliably while remaining vendor-neutral, secure, observable, and supportable across schools with limited connectivity and equipment budgets.

## Supported integration classes

- biometric attendance devices for students and employees;
- normal A4 printers for reports, receipts, cards, and official forms;
- messaging providers such as Telegram/push/other selected services;
- future import/export or accounting/payment integrations through versioned adapters.

## Requirements

| ID | Requirement |
|---|---|
| INT-001 | Maintain a certified hardware/provider compatibility matrix with model, firmware/SDK, capabilities, known issues, and support status. |
| INT-002 | Use adapter interfaces and a versioned canonical event/document contract rather than vendor fields in domain services. |
| INT-003 | Register each device/connector to one tenant/site with unique credentials, rotation/revocation, and least privilege. |
| INT-004 | Provide local durable buffering, batch upload, idempotency, clock monitoring, diagnostics, and safe auto-restart for connectors. |
| INT-005 | Keep fingerprint enrollment/templates on certified device/local trusted boundary by default and exclude them from logs/cloud payloads. |
| INT-006 | Expose device health: last seen, backlog age/count, drift, storage, mapping/errors, adapter version, and firmware where available. |
| INT-007 | Generate official PDFs from cloud-authoritative committed data and print via browser/Electron/OS on A4 printers. |
| INT-008 | Treat print/reprint as separate from business commit; retain document ID/checksum/version and reprint audit. |
| INT-009 | Sign and securely update connector/Electron software with a supported-version policy and remote diagnostics that minimize data exposure. |
| INT-010 | Isolate hardware sale/warranty/maintenance terms commercially while enforcing software integration entitlements. |
| INT-011 | Certify physical throughput, resilience, LAN/offline capacity, power recovery, duplicate behavior, clock accuracy, SDK quality, consumables, and local repairability before procurement. |
| INT-012 | Provide reconciliation tools for event backlog, missing ranges, duplicate/unknown users, failed documents, and provider callbacks. |

## Biometric connector contract

Canonical envelope includes schema version, tenant/site/device/connector IDs, vendor event ID, device user code, occurred/received times, configured direction, event method/status, batch ID, adapter/version, and checksum/signature metadata. It excludes biometric templates/images by default.

The cloud acknowledges durable acceptance, not final attendance projection. Connector deletes/archives buffered data only after acknowledged policy and retains a reconciliation window.

## A4 print contract

Server creates a document artifact from an immutable/versioned business record → authorized client fetches PDF → OS prints → client optionally records print result → reprint uses the same document identity and logs actor/reason. Device/printer failure never creates or reverses payment/result state.

## Acceptance criteria

- Pulling network/power during event collection does not lose or duplicate accepted events after recovery.
- A revoked device/connector cannot upload or query events.
- A device from tenant A cannot submit tenant B identifiers.
- Device time drift is detected and does not silently assign the wrong school day.
- A4 Dari/Pashto PDFs render on selected low-cost printers with stable margins/fonts.
- Repeated print produces a reprint audit, not a second receipt/payment.
- Compatibility tests are repeatable before a new model/firmware is approved.

## Open questions

- Initial device models, protocols/SDK licensing, connector host OS, remote support, enrollment workflow, and warranty.
- Whether one device handles both directions or separate entry/exit devices are required.
- Initial printer models only for certification guidance; normal A4 remains default.
- Provider and customer responsibility for LAN, power backup, physical security, and replacements.

## Implementation tracker

- [ ] Define adapter SDK/canonical contracts and certification suite
- [ ] Evaluate affordable biometric candidates with real 500–1,000-user tests
- [ ] Select connector packaging, local storage encryption, update, and diagnostics
- [ ] Implement registration/credentials/buffering/upload/health/reconciliation
- [ ] Implement PDF artifact and print/reprint audit flow
- [ ] Produce deployment, network, power, privacy, and support runbooks
- [ ] Security/failure/clock/throughput testing
- [ ] Pilot certified device and A4 printers
- [ ] Mark Released by adapter/model

