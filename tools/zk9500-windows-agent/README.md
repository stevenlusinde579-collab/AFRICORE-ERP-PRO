# AfriCore ZK9500 Windows Agent

This project is the Windows-side host for the ZKTeco ZKFinger SDK. It is intentionally NOT marked hardware-ready until the official SDK archive, API documentation, and a physical ZK9500 are available for validation.

## Why a Windows agent is required

ZK9500 is a USB optical fingerprint reader, not a standalone attendance terminal. ZKTeco's Windows ZKFinger SDK lists ZK9500 as supported and supplies drivers, development documentation, and demos. The SDK is a native Windows integration, not a browser JavaScript API.

## Intended runtime

- Runs on the school's dedicated Windows PC and starts with Windows.
- Opens the ZK9500 through the vendor SDK and detects disconnect/reconnect.
- Performs enrollment and 1:N matching locally on that PC.
- Keeps fingerprint templates local and protected; never uploads fingerprint images or raw templates to AfriCore cloud.
- Sends only a verified staff identifier, event timestamp, device identifier, and unique event ID to the authenticated AfriCore API.
- Queues attendance events locally while offline and retries safely after connectivity returns.
- Uses server-side tenant authorization. A device is paired to one school and cannot submit events for another school.

## Attendance event rules

The final check-in/check-out rule must be configurable per school and shift. Do not infer checkout merely because a second scan occurred: repeated scans, lunch breaks, overnight shifts, and missed scans can create false attendance. The API must enforce idempotency and a configurable duplicate-scan cooldown.

## SDK integration gate

The SDK is not redistributed in this repository. Place vendor-provided files in a local, untracked vendor/zkfinger/ folder after obtaining them from ZKTeco. Do not commit vendor binaries or fingerprint data.

Before implementing the native adapter, inspect the supplied SDK version, architecture (x86/x64), DLL exports, sample code, and license. Implement and test initialization, device enumeration/open/close, capture, template creation, enrollment, matching, and shutdown against the actual SDK. Do not guess native function signatures.

## Current status

- [x] Isolated feature branch and integration boundary documented.
- [ ] Official SDK archive/API sample received and inspected.
- [ ] Native ZKFinger adapter implemented.
- [ ] Windows service/agent lifecycle and reconnect handling implemented.
- [ ] Local encrypted template store and enrollment workflow implemented.
- [ ] Authenticated event sync and offline queue implemented.
- [ ] Physical ZK9500 tests completed on the target Windows version.
- [ ] HR dashboard pairing/enrollment/attendance UI connected end-to-end.

No production attendance path is enabled by this scaffold.