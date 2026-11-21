using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace AfriCore.Zk9500.Agent;

public sealed class AgentApiClient
{
    private readonly HttpClient _http = new();
    private readonly AgentOptions _options;
    private readonly ILogger<AgentApiClient> _logger;

    public AgentApiClient(IOptions<AgentOptions> options, ILogger<AgentApiClient> logger)
    {
        _options = options.Value;
        _logger = logger;
        var baseUri = new Uri(_options.ApiBaseUrl.TrimEnd('/') + "/");
        if (baseUri.Scheme != Uri.UriSchemeHttps)
            throw new InvalidOperationException("The AfriCore Agent API must use HTTPS.");
        if (string.IsNullOrWhiteSpace(_options.ProtectedToken))
            throw new InvalidOperationException("The Agent has not been paired with an AfriCore device.");
        _http.BaseAddress = baseUri;
        _http.Timeout = TimeSpan.FromSeconds(20);

        if (!string.IsNullOrWhiteSpace(_options.ProtectedToken))
        {
            var protectedBytes = Convert.FromBase64String(_options.ProtectedToken);
            var tokenBytes = ProtectedData.Unprotect(protectedBytes, null, DataProtectionScope.LocalMachine);
            var token = Encoding.UTF8.GetString(tokenBytes);
            CryptographicOperations.ZeroMemory(tokenBytes);
            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
    }

    public async Task<bool> HeartbeatAsync(CancellationToken cancellationToken)
    {
        using var response = await _http.PostAsJsonAsync(
            "api/hr/biometric/agent/heartbeat",
            new { agent_version = _options.AgentVersion },
            cancellationToken);

        if (!response.IsSuccessStatusCode)
            _logger.LogWarning("Agent heartbeat returned HTTP {StatusCode}", (int)response.StatusCode);

        return response.IsSuccessStatusCode;
    }

    public async Task<SyncResult> SyncAsync(
        IReadOnlyList<AttendanceQueueItem> events,
        CancellationToken cancellationToken)
    {
        using var response = await _http.PostAsJsonAsync(
            "api/hr/biometric/agent/attendance/sync",
            new
            {
                events = events.Select(item => new
                {
                    event_id = item.EventId,
                    employee_id = item.EmployeeId,
                    occurred_at = item.OccurredAt
                })
            },
            cancellationToken);

        if (!response.IsSuccessStatusCode)
            return new SyncResult(false, 0, 0, Array.Empty<RejectedAttendanceEvent>(), $"HTTP {(int)response.StatusCode}");

        var result = await response.Content.ReadFromJsonAsync<ApiSyncResult>(cancellationToken: cancellationToken);
        if (result is null || !result.success)
            return new SyncResult(false, 0, 0, Array.Empty<RejectedAttendanceEvent>(), "API did not confirm successful processing.");

        var rejected = (result.rejected ?? new List<ApiRejectedEvent>())
            .Where(item => !string.IsNullOrWhiteSpace(item.event_id))
            .Select(item => new RejectedAttendanceEvent(item.event_id!, item.reason ?? "rejected_by_server"))
            .ToArray();

        var rejectedIds = rejected.Select(item => item.EventId).ToHashSet(StringComparer.Ordinal);
        if (rejectedIds.Count > events.Count || result.accepted < 0 || result.duplicates < 0 ||
            result.accepted + result.duplicates + rejectedIds.Count != events.Count ||
            rejectedIds.Any(id => !events.Any(item => item.EventId == id)))
        {
            return new SyncResult(false, 0, 0, Array.Empty<RejectedAttendanceEvent>(), "Server acknowledgement did not account for every queued event.");
        }

        return new SyncResult(true, result.accepted, result.duplicates, rejected, null);
    }

    private sealed record ApiRejectedEvent(string? event_id, string? reason);
    private sealed record ApiSyncResult(bool success, int accepted, int duplicates, List<ApiRejectedEvent>? rejected);
}
