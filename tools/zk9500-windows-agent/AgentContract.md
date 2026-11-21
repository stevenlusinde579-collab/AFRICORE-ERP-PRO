# ZK9500 Agent Contract

## Local device adapter

The native adapter must expose these operations without leaking vendor-specific types:
- InitializeAsync
- EnumerateDevicesAsync
- OpenAsync(device)
- CaptureAsync
- CreateEnrollmentTemplateAsync(captures)
- IdentifyAsync(capture, localTemplates)
- CloseAsync / DisposeAsync

The implementation must use the exact ZKFinger SDK version delivered for this project. Missing SDK, unsupported architecture, no device, or SDK error must return an unavailable/error status, never a simulated successful match.

## Enrollment

1. An authenticated HR Manager selects an active employee in the correct school.
2. The cloud issues a short-lived enrollment authorization bound to school, employee, and agent pairing.
3. The agent captures the required fingerprint samples and creates a template locally.
4. The template is stored encrypted on the paired PC; only a non-reversible enrollment reference/status is stored in the cloud.
5. Enrollment is complete only after a test identification succeeds locally.

## Attendance event payload

The agent sends only:
- event_id: cryptographically random UUID for idempotency
- school_id: paired school, verified server-side (never trusted from browser input)
- employee_id: local match result, checked against active employee and paired school
- device_id: paired biometric device
- occurred_at: UTC timestamp captured by the agent
- event_type: server-derived check-in/check-out according to school shift policy
- event_source: fixed to usb_biometric

The API must reject unknown employees, inactive devices, invalid pairing, cross-school references, replayed event IDs, and duplicate scans within the configured cooldown.

## Offline queue

- Persist pending events in a local transactional store.
- Retry with exponential backoff and jitter.
- Keep the same event ID for every retry.
- Delete an event only after the server confirms durable acceptance.
- Expose queue depth and last successful sync time to the local health endpoint.
- Never store fingerprint captures in the queue.

## Local API security

If a localhost API is used for browser UI, bind only to loopback, require a per-installation pairing secret, validate the requesting AfriCore origin, and never expose SDK or enrollment operations to arbitrary web pages. Prefer outbound agent-to-cloud sync over inbound internet access to the PC.

## Data protection

Fingerprint templates are biometric data. Keep them on the school's secured PC, encrypt at rest, restrict file/OS permissions, provide explicit employee template revocation/deletion, and never log captures or templates. Define retention and backup policy before production.