namespace AfriCore.Zk9500.Agent;
public sealed record AttendanceQueueItem(string EventId,long EmployeeId,DateTimeOffset OccurredAt);
public sealed record SyncResult(bool Success,int Accepted,int Duplicates,string? Error);