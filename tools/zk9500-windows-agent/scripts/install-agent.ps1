[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [System.Security.SecureString]$AgentToken,
    [string]$ApiBaseUrl = "https://africore-erp-pro.onrender.com",
    [string]$InstallDirectory = "$env:ProgramFiles\AfriCore\ZK9500",
    [string]$DataDirectory = "$env:ProgramData\AfriCore\ZK9500"
)
$ErrorActionPreference = "Stop"
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this script from PowerShell as Administrator."
}
if ($null -eq $AgentToken -or $AgentToken.Length -lt 32) {
    throw "The one-time AfriCore pairing token is missing or invalid."
}
$serviceName = "AfriCore ZK9500 Agent"
$exePath = Join-Path $InstallDirectory "AfriCore.Zk9500.Agent.exe"
if (-not (Test-Path $exePath)) { throw "Agent executable not found at $exePath. Publish/copy the Windows Agent first." }
New-Item -ItemType Directory -Force -Path $DataDirectory | Out-Null
$acl = Get-Acl $DataDirectory
$acl.SetAccessRuleProtection($true, $false)
$acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) | Out-Null }
$systemRule = New-Object System.Security.AccessControl.FileSystemAccessRule("SYSTEM", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
$adminRule = New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\Administrators", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.SetAccessRule($systemRule)
$acl.SetAccessRule($adminRule)
Set-Acl -Path $DataDirectory -AclObject $acl
Add-Type -AssemblyName System.Security.Cryptography.ProtectedData
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($AgentToken)
try {
    $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
    $tokenBytes = [Text.Encoding]::UTF8.GetBytes($plainToken)
    $protectedBytes = [Security.Cryptography.ProtectedData]::Protect($tokenBytes, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
    $protectedToken = [Convert]::ToBase64String($protectedBytes)
    [Array]::Clear($tokenBytes, 0, $tokenBytes.Length)
    $plainToken = $null
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
}
[Environment]::SetEnvironmentVariable("AfriCoreAgent__ProtectedToken", $protectedToken, "Machine")
[Environment]::SetEnvironmentVariable("AfriCoreAgent__ApiBaseUrl", $ApiBaseUrl.TrimEnd("/"), "Machine")
[Environment]::SetEnvironmentVariable("AfriCoreAgent__DataDirectory", $DataDirectory, "Machine")
$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    & sc.exe delete $serviceName | Out-Null
    Start-Sleep -Seconds 2
}
& sc.exe create $serviceName binPath= "`"$exePath`"" start= auto obj= LocalSystem | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Windows service creation failed." }
& sc.exe failure $serviceName reset= 86400 actions= restart/5000/restart/15000/restart/60000 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Windows service recovery policy could not be configured." }
Write-Host "AfriCore ZK9500 Agent service installed."
Write-Host "Pairing token protected with Windows DPAPI LocalMachine; plaintext was not written to disk."
Write-Host "Restart the service after changing machine environment variables."
