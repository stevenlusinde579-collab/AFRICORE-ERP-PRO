using AfriCore.Zk9500.Agent;
var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddWindowsService(options => options.ServiceName = "AfriCore ZK9500 Agent");
builder.Services.Configure<AgentOptions>(builder.Configuration.GetSection("AfriCoreAgent"));
builder.Services.AddSingleton<LocalStore>();
builder.Services.AddSingleton<AgentApiClient>();
builder.Services.AddSingleton<IZkFingerSdkAdapter, ZkFingerSdkAdapter>();
builder.Services.AddHostedService<AgentWorker>();
await builder.Build().RunAsync();