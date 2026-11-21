using Microsoft.Extensions.Options;
namespace AfriCore.Zk9500.Agent;
public sealed class AgentWorker:BackgroundService
{
 private readonly AgentOptions _options;private readonly LocalStore _store;private readonly AgentApiClient _api;private readonly IZkFingerSdkAdapter _sdk;private readonly ILogger<AgentWorker> _logger;
 public AgentWorker(IOptions<AgentOptions> options,LocalStore store,AgentApiClient api,IZkFingerSdkAdapter sdk,ILogger<AgentWorker> logger){_options=options.Value;_store=store;_api=api;_sdk=sdk;_logger=logger;}
 protected override async Task ExecuteAsync(CancellationToken stoppingToken)
 {
  _logger.LogInformation("AfriCore ZK9500 Agent started. SDK state: {State}",(await _sdk.GetStatusAsync(stoppingToken)).State);
  var lastHeartbeat=DateTimeOffset.MinValue;
  while(!stoppingToken.IsCancellationRequested){try{
   if(DateTimeOffset.UtcNow-lastHeartbeat>=TimeSpan.FromSeconds(Math.Max(20,_options.HeartbeatSeconds))){await _api.HeartbeatAsync(stoppingToken);lastHeartbeat=DateTimeOffset.UtcNow;}
   var batch=_store.ReadBatch(100);
   if(batch.Count>0){var result=await _api.SyncAsync(batch,stoppingToken);if(result.Success)_store.MarkSynced(batch.Select(x=>x.EventId));else _store.MarkFailed(batch.Select(x=>x.EventId),result.Error??"Sync failed");}
   await Task.Delay(TimeSpan.FromSeconds(Math.Max(10,_options.SyncSeconds)),stoppingToken);
  }catch(OperationCanceledException)when(stoppingToken.IsCancellationRequested){break;}catch(Exception ex){_logger.LogError(ex,"Agent loop error");await Task.Delay(TimeSpan.FromSeconds(10),stoppingToken);}}
 }
}