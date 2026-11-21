namespace AfriCore.Zk9500.Agent;
public sealed class AgentOptions
{
 public string ApiBaseUrl { get; set; } = "https://africore-erp-pro.onrender.com";
 public string DeviceId { get; set; } = "";
 public string ProtectedToken { get; set; } = "";
 public string DataDirectory { get; set; } = @"C:\ProgramData\AfriCore\ZK9500";
 public int HeartbeatSeconds { get; set; } = 60;
 public int SyncSeconds { get; set; } = 20;
 public string AgentVersion { get; set; } = "0.1.0";
}