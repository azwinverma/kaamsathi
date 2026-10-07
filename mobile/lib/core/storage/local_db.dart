import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// On-device SQLite database: the offline hajiri queue and cached rosters.
abstract final class LocalDb {
  static const name = 'kaamsathi.db';
  static const version = 1;

  static Future<Database> open() async {
    final dir = await getDatabasesPath();
    return openDatabase(
      p.join(dir, name),
      version: version,
      onCreate: (db, _) => createSchema(db),
    );
  }

  /// Also used by tests with an in-memory FFI database.
  static Future<void> createSchema(DatabaseExecutor db) async {
    await db.execute('''
      CREATE TABLE attendance_queue (
        client_uuid TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        employment_id TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        overtime_minutes INTEGER NOT NULL DEFAULT 0,
        note TEXT,
        method TEXT NOT NULL DEFAULT 'supervisor',
        state TEXT NOT NULL DEFAULT 'pending',
        error_code TEXT,
        error_message TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    ''');
    await db.execute(
      'CREATE INDEX idx_queue_key ON attendance_queue (org_id, employment_id, date)',
    );
    await db.execute('''
      CREATE TABLE day_cache (
        cache_key TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        site_key TEXT NOT NULL,
        date TEXT NOT NULL,
        json TEXT NOT NULL,
        saved_at INTEGER NOT NULL
      )
    ''');
  }
}
