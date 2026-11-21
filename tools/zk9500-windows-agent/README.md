# AfriCore ZK9500 Windows Agent

This is the Windows-side component for the ZKTeco ZK9500 USB optical fingerprint reader.

## Implemented foundation
- Windows Service host configured to run under Windows Service Control Manager.
- Windows USB device arrival/removal event monitor.
- Local SQLite queue schema, idempotent event IDs, and retry scheduling.
- HTTPS agent heartbeat and batch attendance sync client.
- Machine-scoped Windows DPAPI decryption for the one-time paired agent token.
- Explicit SDK adapter boundary which fails closed and never fabricates fingerprint matches.

## Build
Requires Windows x64 and .NET 8 SDK. From the project folder run:
- dotnet restore
- dotnet publish -c Release -r win-x64 --self-contained false

## Install service (elevated PowerShell)
After publishing to C:\Program Files\AfriCore\ZK9500:
- sc.exe create "AfriCore ZK9500 Agent" binPath= "C:\Program Files\AfriCore\ZK9500\AfriCore.Zk9500.Agent.exe" start= auto
- sc.exe failure "AfriCore ZK9500 Agent" reset= 86400 actions= restart/5000/restart/15000/restart/60000
- sc.exe start "AfriCore ZK9500 Agent"

## Pairing
HR Manager registers the ZK9500 in AfriCore and uses Pair Windows Agent. The API generates a one-time high-entropy token and stores only its SHA-256 hash in Supabase. The plaintext token must be provisioned to the Windows service and protected using Windows DPAPI LocalMachine. Never commit plaintext tokens or school service keys.

## Hardware SDK gate
Native ZK9500 capture, local fingerprint enrollment/matching, and event production remain disabled until the official ZKFinger SDK package, exact API documentation, and sample code are available and validated. USB attach/detach notifications are detected, but they do not mean a fingerprint was read. No raw fingerprint image or template is uploaded to Supabase.

## Important
The Windows Agent currently provides the service/monitoring/sync foundation only. Do not mark a device operational until the real SDK adapter, local template store, enrollment/matching flow, and physical ZK9500 tests pass. The backend currently alternates check-in/check-out events per employee per local day; this is a basic fallback policy and must be aligned with the school's attendance shift rules before production attendance is enabled.
