# AfriCore ZK9500 Windows Agent

This is the Windows-side component for the ZKTeco ZK9500 USB optical fingerprint reader.

## Foundation included
- Windows Service host with automatic start and service recovery configuration.
- Windows USB arrival/removal notifications.
- Local SQLite attendance queue with exponential retry/backoff and a dead-letter table for permanent server rejections.
- HTTPS agent heartbeat and batch synchronization.
- Machine-scoped Windows DPAPI token decryption.
- SDK adapter boundary that fails closed until the official SDK is inspected.

## Build
Requires Windows x64 and .NET 8 SDK. From the project folder run:
- dotnet restore
- dotnet publish -c Release -r win-x64 --self-contained false

A GitHub Actions workflow also builds the Windows x64 service on a Windows runner and uploads the artifact. The CI build does not require the physical scanner; the build log must still be reviewed before release.

## Install and pair
1. Publish/copy the Windows Agent to C:\Program Files\AfriCore\ZK9500.
2. In AfriCore, register the ZK9500 and use the Pair Windows Agent action.
3. Copy the one-time token securely. Never commit it to Git or store it in a plaintext configuration file.
4. Open PowerShell as Administrator and run the installer script with a SecureString token:

   $secureToken = Read-Host "One-time AfriCore pairing token" -AsSecureString
   .\scripts\install-agent.ps1 -AgentToken $secureToken

5. The script protects the token using Windows DPAPI LocalMachine, stores only the protected value as a machine environment variable, applies restrictive ACLs to the data directory, installs the Windows service as LocalSystem, and configures automatic restart after service failure.

## SDK and hardware gate
The official ZKFinger SDK native adapter, USB vendor/product identification, fingerprint capture, local enrollment/matching, local template protection, and real scan-to-event producer are not implemented yet. USB attach/detach notifications do not mean a fingerprint was read. No raw fingerprint image or template is uploaded to Supabase.

The backend attendance sync endpoint is intentionally disabled by default until the official SDK, a school-approved check-in/check-out direction policy, and physical validation are complete. Do not mark a device operational until the SDK adapter, local template store, enrollment/matching flow, Windows build, and physical ZK9500 tests pass.
