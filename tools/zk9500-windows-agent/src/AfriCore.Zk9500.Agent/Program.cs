using AfriCore.Zk9500.Agent;
using Microsoft.Extensions.Configuration;

var builder = Host.CreateApplicationBuilder(args);
var dataDirectory = Environment.GetEnvironmentVariable("AFRICORE_AGENT_DATA_DIRECTORY")
    ?? Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "AfriCore",
        "ZK9500");

// The token-bearing settings file is stored under ProgramData with SYSTEM/Admin-only ACLs.
builder.Configuration.AddJsonFile(
    Path.Combine(dataDirectory, "agentsettings.json"),
    optional: true,
    reloadOnChange: false);
builder.Configuration.AddEnvironmentVariables();

builder.Services.AddWindowsService(options => options.ServiceName = "AfriCore ZK9500 Agent");
builder.Services.Configure<AgentOptions>(builder.Configuration.GetSection("AfriCoreAgent"));
builder.Services.AddSingleton<LocalStore>();
builder.Services.AddSingleton<AgentApiClient>();
builder.Services.AddSingleton<IZkFingerSdkAdapter, ZkFingerSdkAdapter>();
builder.Services.AddHostedService<AgentWorker>();
builder.Services.AddHostedService<UsbDeviceMonitor>();
await builder.Build().RunAsync();
