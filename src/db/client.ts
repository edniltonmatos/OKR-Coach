import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('okr_coach.db');
  }
  const db = await dbPromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);
  return db;
}

export async function runMigrations(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cycle (
      id TEXT PRIMARY KEY NOT NULL,
      objective_title TEXT NOT NULL,
      start_date TEXT NOT NULL,
      week_count INTEGER NOT NULL DEFAULT 12,
      review_weekday INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS key_result (
      id TEXT PRIMARY KEY NOT NULL,
      cycle_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      label TEXT NOT NULL,
      initial_value REAL NOT NULL,
      target_value REAL NOT NULL,
      current_value REAL NOT NULL,
      FOREIGN KEY (cycle_id) REFERENCES cycle(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS week_entry (
      id TEXT PRIMARY KEY NOT NULL,
      cycle_id TEXT NOT NULL,
      week_number INTEGER NOT NULL,
      kr1_value REAL,
      kr2_value REAL,
      kr3_value REAL,
      notes TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      UNIQUE (cycle_id, week_number),
      FOREIGN KEY (cycle_id) REFERENCES cycle(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_message (
      id TEXT PRIMARY KEY NOT NULL,
      cycle_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (cycle_id) REFERENCES cycle(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_kr_cycle ON key_result(cycle_id);
    CREATE INDEX IF NOT EXISTS idx_week_cycle ON week_entry(cycle_id);
    CREATE INDEX IF NOT EXISTS idx_chat_cycle ON chat_message(cycle_id);
  `);
}
