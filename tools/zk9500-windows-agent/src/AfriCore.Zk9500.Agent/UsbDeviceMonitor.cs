using System.Management;
namespace AfriCore.Zk9500.Agent;

/// <summary>Reports Windows USB device arrival/removal. It does not claim a fingerprint read.</summary>
public sealed class UsbDeviceMonitor : BackgroundService
{
 private readonly ILogger<UsbDeviceMonitor> _logger;
 public UsbDeviceMonitor(ILogger<UsbDeviceMonitor> logger)=>_logger=logger;
 protected override Task ExecuteAsync(CancellationToken stoppingToken)
 {
  try
  {
   var arrival=new ManagementEventWatcher(new WqlEventQuery("SELECT * FROM Win32_DeviceChangeEvent WHERE EventType = 2"));
   var removal=new ManagementEventWatcher(new WqlEventQuery("SELECT * FROM Win32_DeviceChangeEvent WHERE EventType = 3"));
   arrival.EventArrived+=(s,e)=>_logger.LogInformation("Windows reported a device arrival. ZK9500 SDK adapter will determine supported scanner state.");
   removal.EventArrived+=(s,e)=>_logger.LogWarning("Windows reported a device removal.");
   arrival.Start();removal.Start();
   stoppingToken.Register(()=>{arrival.Stop();removal.Stop();arrival.Dispose();removal.Dispose();});
   return Task.CompletedTask;
  }
  catch(Exception ex){_logger.LogError(ex,"USB device notifications could not be initialized.");return Task.CompletedTask;}
 }
}