using System.Management;
namespace AfriCore.Zk9500.Agent;

/// <summary>Reports Windows USB device arrival/removal. It does not claim a fingerprint read.</summary>
public sealed class UsbDeviceMonitor : BackgroundService
{
 private readonly ILogger<UsbDeviceMonitor> _logger;
 public UsbDeviceMonitor(ILogger<UsbDeviceMonitor> logger)=>_logger=logger;
 protected override async Task ExecuteAsync(CancellationToken stoppingToken)
 {
  ManagementEventWatcher? arrival=null;ManagementEventWatcher? removal=null;
  try
  {
   arrival=new ManagementEventWatcher(new WqlEventQuery("SELECT * FROM Win32_DeviceChangeEvent WHERE EventType = 2"));
   removal=new ManagementEventWatcher(new WqlEventQuery("SELECT * FROM Win32_DeviceChangeEvent WHERE EventType = 3"));
   arrival.EventArrived+=(s,e)=>_logger.LogInformation("Windows reported a USB device arrival. SDK adapter must identify the supported scanner.");
   removal.EventArrived+=(s,e)=>_logger.LogWarning("Windows reported a USB device removal.");
   arrival.Start();removal.Start();
   await Task.Delay(Timeout.Infinite,stoppingToken);
  }
  catch(OperationCanceledException) when(stoppingToken.IsCancellationRequested){}
  catch(Exception ex){_logger.LogError(ex,"USB device notifications could not be initialized.");}
  finally{arrival?.Stop();removal?.Stop();arrival?.Dispose();removal?.Dispose();}
 }
}