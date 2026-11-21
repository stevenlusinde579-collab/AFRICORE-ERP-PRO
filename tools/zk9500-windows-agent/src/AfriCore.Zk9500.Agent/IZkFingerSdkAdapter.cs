namespace AfriCore.Zk9500.Agent;
public interface IZkFingerSdkAdapter
{
 Task<AdapterStatus> GetStatusAsync(CancellationToken cancellationToken);
 Task StartCaptureAsync(CancellationToken cancellationToken);
 Task StopCaptureAsync(CancellationToken cancellationToken);
}
public sealed record AdapterStatus(bool Available,string State,string Detail);
// Fail closed until official ZKFinger SDK binaries and exact API documentation are validated.
public sealed class ZkFingerSdkAdapter : IZkFingerSdkAdapter
{
 public Task<AdapterStatus> GetStatusAsync(CancellationToken ct)=>Task.FromResult(new AdapterStatus(false,"sdk_required","Official ZKFinger SDK runtime is not installed/configured."));
 public Task StartCaptureAsync(CancellationToken ct)=>throw new InvalidOperationException("Fingerprint capture is disabled until the official ZKFinger SDK adapter is installed.");
 public Task StopCaptureAsync(CancellationToken ct)=>Task.CompletedTask;
}