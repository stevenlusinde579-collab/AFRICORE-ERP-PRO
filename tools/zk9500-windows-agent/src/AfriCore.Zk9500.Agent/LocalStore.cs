using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Options;

namespace AfriCore.Zk9500.Agent;

public sealed class LocalStore
{
    private readonly string _connectionString;

    public LocalStore(IOptions<AgentOptions> options)
    {
        Directory.CreateDirectory(options.Value.DataDirectory);
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = Path.Combine(options.Value.DataDirectory, "agent-queue.db"),
            Mode = SqliteOpenMode.ReadWriteCreate
        }.ToString();

        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS attendance_queue(
                event_id TEXT PRIMARY KEY,
                employee_id INTEGER NOT NULL,
                occurred_at TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_error TEXT
            );
            CREATE TABLE IF NOT EXISTS attendance_deadletter(
                event_id TEXT PRIMARY KEY,
                employee_id INTEGER NOT NULL,
                occurred_at TEXT NOT NULL,
                rejection_reason TEXT NOT NULL,
                rejected_at TEXT NOT NULL
            );
            """;
        command.ExecuteNonQuery();
    }

    private SqliteConnection Open()
    {
        var connection = new SqliteConnection(_connectionString);
        connection.Open();
        return connection;
    }

    public void Enqueue(long employeeId, DateTimeOffset occurredAt)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT OR IGNORE INTO attendance_queue(event_id, employee_id, occurred_at)
            VALUES($id, $employee, $at)
            """;
        command.Parameters.AddWithValue("$id", "local_" + Guid.NewGuid().ToString("N"));
        command.Parameters.AddWithValue("$employee", employeeId);
        command.Parameters.AddWithValue("$at", occurredAt.ToUniversalTime().ToString("O"));
        command.ExecuteNonQuery();
    }

    public IReadOnlyList<AttendanceQueueItem> ReadBatch(int limit = 100)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT event_id, employee_id, occurred_at
            FROM attendance_queue
            WHERE julianday(next_attempt_at) <= julianday($now)
            ORDER BY occurred_at
            LIMIT $limit
            """;
        command.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O"));
        command.Parameters.AddWithValue("$limit", limit);

        using var reader = command.ExecuteReader();
        var items = new List<AttendanceQueueItem>();
        while (reader.Read())
        {
            items.Add(new AttendanceQueueItem(
                reader.GetString(0),
                reader.GetInt64(1),
                DateTimeOffset.Parse(reader.GetString(2))));
        }
        return items;
    }

    public void MarkSynced(IEnumerable<string> ids)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        foreach (var id in ids)
        {
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = "DELETE FROM attendance_queue WHERE event_id = $id";
            command.Parameters.AddWithValue("$id", id);
            command.ExecuteNonQuery();
        }
        transaction.Commit();
    }

    public void MarkRejected(IEnumerable<AttendanceQueueItem> items, IReadOnlyDictionary<string, string> reasons)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        foreach (var item in items)
        {
            if (!reasons.TryGetValue(item.EventId, out var reason)) continue;

            using (var insert = connection.CreateCommand())
            {
                insert.Transaction = transaction;
                insert.CommandText = """
                    INSERT OR REPLACE INTO attendance_deadletter
                    (event_id, employee_id, occurred_at, rejection_reason, rejected_at)
                    VALUES($id, $employee, $at, $reason, $rejected)
                    """;
                insert.Parameters.AddWithValue("$id", item.EventId);
                insert.Parameters.AddWithValue("$employee", item.EmployeeId);
                insert.Parameters.AddWithValue("$at", item.OccurredAt.ToUniversalTime().ToString("O"));
                insert.Parameters.AddWithValue("$reason", reason.Length > 300 ? reason[..300] : reason);
                insert.Parameters.AddWithValue("$rejected", DateTimeOffset.UtcNow.ToString("O"));
                insert.ExecuteNonQuery();
            }

            using (var delete = connection.CreateCommand())
            {
                delete.Transaction = transaction;
                delete.CommandText = "DELETE FROM attendance_queue WHERE event_id = $id";
                delete.Parameters.AddWithValue("$id", item.EventId);
                delete.ExecuteNonQuery();
            }
        }
        transaction.Commit();
    }

    public void MarkFailed(IEnumerable<string> ids, string message)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        foreach (var id in ids)
        {
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = """
                UPDATE attendance_queue
                SET attempts = attempts + 1,
                    next_attempt_at = strftime(
                        '%Y-%m-%dT%H:%M:%fZ',
                        'now',
                        printf('+%d seconds', min(3600, 15 * (1 << min(attempts, 8))))
                    ),
                    last_error = $error
                WHERE event_id = $id
                """;
            command.Parameters.AddWithValue("$error", message.Length > 300 ? message[..300] : message);
            command.Parameters.AddWithValue("$id", id);
            command.ExecuteNonQuery();
        }
        transaction.Commit();
    }
}
