using Microsoft.Extensions.Options;

namespace AfriCore.Zk9500.Agent;

public sealed class AgentWorker : BackgroundService
{
    private readonly AgentOptions _options;
    private readonly LocalStore _store;
    private readonly AgentApiClient _api;
    private readonly IZkFingerSdkAdapter _sdk;
    private readonly ILogger<AgentWorker> _logger;

    public AgentWorker(
        IOptions<AgentOptions> options,
        LocalStore store,
        AgentApiClient api,
        IZkFingerSdkAdapter sdk,
        ILogger<AgentWorker> logger)
    {
        _options = options.Value;
        _store = store;
        _api = api;
        _sdk = sdk;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var sdkStatus = await _sdk.GetStatusAsync(stoppingToken);
        _logger.LogInformation(
            "AfriCore ZK9500 Agent started. SDK state: {State}. Detail: {Detail}",
            sdkStatus.State,
            sdkStatus.Detail);

        var lastSuccessfulHeartbeat = DateTimeOffset.MinValue;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (DateTimeOffset.UtcNow - lastSuccessfulHeartbeat >=
                    TimeSpan.FromSeconds(Math.Max(20, _options.HeartbeatSeconds)))
                {
                    if (await _api.HeartbeatAsync(stoppingToken))
                        lastSuccessfulHeartbeat = DateTimeOffset.UtcNow;
                }

                var batch = _store.ReadBatch(100);
                if (batch.Count > 0)
                {
                    var result = await _api.SyncAsync(batch, stoppingToken);
                    if (result.Success)
                    {
                        var rejectedReasons = result.Rejected.ToDictionary(
                            item => item.EventId,
                            item => item.Reason,
                            StringComparer.Ordinal);

                        if (rejectedReasons.Count > 0)
                        {
                            _store.MarkRejected(batch, rejectedReasons);
                            _logger.LogWarning(
                                "Server rejected {Count} attendance event(s); records retained in the local dead-letter store.",
                                rejectedReasons.Count);
                        }

                        var rejectedIds = rejectedReasons.Keys.ToHashSet(StringComparer.Ordinal);
                        _store.MarkSynced(batch
                            .Where(item => !rejectedIds.Contains(item.EventId))
                            .Select(item => item.EventId));
                    }
                    else
                    {
                        _store.MarkFailed(batch.Select(item => item.EventId), result.Error ?? "Sync was not confirmed.");
                        _logger.LogWarning("Attendance batch retained for retry: {Reason}", result.Error);
                    }
                }

                await Task.Delay(TimeSpan.FromSeconds(Math.Max(10, _options.SyncSeconds)), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                _logger.LogError(exception, "Agent loop failed; queued events remain on this PC.");
                await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
            }
        }
    }
}
