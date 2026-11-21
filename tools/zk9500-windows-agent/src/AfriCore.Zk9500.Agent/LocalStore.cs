using Microsoft.Data.Sqlite;
namespace AfriCore.Zk9500.Agent;
public sealed class LocalStore
{
 private readonly string _connectionString;
 public LocalStore(Microsoft.Extensions.Options.IOptions<AgentOptions> options)
 {
  Directory.CreateDirectory(options.Value.DataDirectory);
  _connectionString = new SqliteConnectionStringBuilder { DataSource = Path.Combine(options.Value.DataDirectory,"agent-queue.db"), Mode = SqliteOpenMode.ReadWriteCreate }.ToString();
  using var c=Open(); using var cmd=c.CreateCommand();
  cmd.CommandText="PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS attendance_queue(event_id TEXT PRIMARY KEY,employee_id INTEGER NOT NULL,occurred_at TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_error TEXT);";
  cmd.ExecuteNonQuery();
 }
 private SqliteConnection Open(){var c=new SqliteConnection(_connectionString);c.Open();return c;}
 public void Enqueue(long employeeId,DateTimeOffset occurredAt)
 {
  using var c=Open();using var cmd=c.CreateCommand();
  cmd.CommandText="INSERT OR IGNORE INTO attendance_queue(event_id,employee_id,occurred_at) VALUES($id,$employee,$at)";
  cmd.Parameters.AddWithValue("$id","local_"+Guid.NewGuid().ToString("N"));
  cmd.Parameters.AddWithValue("$employee",employeeId);
  cmd.Parameters.AddWithValue("$at",occurredAt.ToUniversalTime().ToString("O"));
  cmd.ExecuteNonQuery();
 }
 public IReadOnlyList<AttendanceQueueItem> ReadBatch(int limit=100)
 {
  using var c=Open();using var cmd=c.CreateCommand();
  cmd.CommandText="SELECT event_id,employee_id,occurred_at FROM attendance_queue WHERE next_attempt_at <= $now ORDER BY occurred_at LIMIT $limit";
  cmd.Parameters.AddWithValue("$now",DateTimeOffset.UtcNow.ToString("O"));cmd.Parameters.AddWithValue("$limit",limit);
  using var r=cmd.ExecuteReader();var items=new List<AttendanceQueueItem>();
  while(r.Read())items.Add(new(r.GetString(0),r.GetInt64(1),DateTimeOffset.Parse(r.GetString(2))));
  return items;
 }
 public void MarkSynced(IEnumerable<string> ids){using var c=Open();using var tx=c.BeginTransaction();foreach(var id in ids){using var cmd=c.CreateCommand();cmd.Transaction=tx;cmd.CommandText="DELETE FROM attendance_queue WHERE event_id=$id";cmd.Parameters.AddWithValue("$id",id);cmd.ExecuteNonQuery();}tx.Commit();}
 public void MarkFailed(IEnumerable<string> ids,string message){using var c=Open();using var tx=c.BeginTransaction();foreach(var id in ids){using var cmd=c.CreateCommand();cmd.Transaction=tx;cmd.CommandText="UPDATE attendance_queue SET attempts=attempts+1,next_attempt_at=$next,last_error=$error WHERE event_id=$id";cmd.Parameters.AddWithValue("$next",DateTimeOffset.UtcNow.AddMinutes(2).ToString("O"));cmd.Parameters.AddWithValue("$error",message[..Math.Min(message.Length,300)]);cmd.Parameters.AddWithValue("$id",id);cmd.ExecuteNonQuery();}tx.Commit();}
}