using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
namespace AfriCore.Zk9500.Agent;
public sealed class AgentApiClient
{
 private readonly HttpClient _http=new();private readonly AgentOptions _options;private readonly ILogger<AgentApiClient> _logger;
 public AgentApiClient(IOptions<AgentOptions> options,ILogger<AgentApiClient> logger)
 {
  _options=options.Value;_logger=logger;_http.BaseAddress=new Uri(_options.ApiBaseUrl.TrimEnd('/')+"/");_http.Timeout=TimeSpan.FromSeconds(20);
  if(!string.IsNullOrWhiteSpace(_options.ProtectedToken)){var bytes=Convert.FromBase64String(_options.ProtectedToken);var token=Encoding.UTF8.GetString(ProtectedData.Unprotect(bytes,null,DataProtectionScope.LocalMachine));_http.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",token);}
 }
 public async Task<bool> HeartbeatAsync(CancellationToken ct){var r=await _http.PostAsJsonAsync("api/hr/biometric/agent/heartbeat",new{agent_version=_options.AgentVersion},ct);if(!r.IsSuccessStatusCode)_logger.LogWarning("Heartbeat HTTP {Status}",r.StatusCode);return r.IsSuccessStatusCode;}
 public async Task<SyncResult> SyncAsync(IReadOnlyList<AttendanceQueueItem> events,CancellationToken ct)
 {
  var r=await _http.PostAsJsonAsync("api/hr/biometric/agent/attendance/sync",new{events=events.Select(e=>new{event_id=e.EventId,employee_id=e.EmployeeId,occurred_at=e.OccurredAt})},ct);
  if(!r.IsSuccessStatusCode)return new(false,0,0,$"HTTP {(int)r.StatusCode}");
  var result=await r.Content.ReadFromJsonAsync<ApiSyncResult>(cancellationToken:ct);
  return result is null?new(false,0,0,"Empty API response"):new(true,result.accepted,result.duplicates,null);
 }
 private sealed record ApiSyncResult(bool success,int accepted,int duplicates);
}