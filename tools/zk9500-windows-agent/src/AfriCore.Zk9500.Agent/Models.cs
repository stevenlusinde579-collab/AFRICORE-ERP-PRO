namespace AfriCore.Zk9500.Agent;

public sealed record AttendanceQueueItem(string EventId, long EmployeeId, DateTimeOffset OccurredAt);
public sealed record RejectedAttendanceEvent(string EventId, string Reason);
public sealed record SyncResult(bool Success, int Accepted, int Duplicates, IReadOnlyList<RejectedAttendanceEvent> Rejected, string? Error);
