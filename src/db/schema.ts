import type Database from 'better-sqlite3';

/**
 * Initialize the database schema, creating all tables and indexes
 * if they do not already exist.
 */
export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mastery (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      stability REAL NOT NULL DEFAULT 1.0,
      difficulty REAL NOT NULL DEFAULT 0.3,
      retrievability REAL NOT NULL DEFAULT 1.0,
      review_due TEXT NOT NULL,
      times_reviewed INTEGER NOT NULL DEFAULT 0,
      times_correct INTEGER NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 0,
      last_reviewed TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      domain TEXT NOT NULL DEFAULT 'general',
      started_at TEXT NOT NULL,
      ended_at TEXT,
      outcome TEXT,
      message_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      claims_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS code_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      language TEXT,
      framework TEXT,
      patterns_json TEXT,
      last_analyzed TEXT,
      file_count INTEGER DEFAULT 0,
      loc INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS code_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES code_projects(id),
      relative_path TEXT NOT NULL,
      language TEXT,
      loc INTEGER DEFAULT 0,
      last_modified TEXT,
      hash TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_mastery_domain ON mastery(domain);
    CREATE INDEX IF NOT EXISTS idx_mastery_review_due ON mastery(review_due);
    CREATE INDEX IF NOT EXISTS idx_mastery_status ON mastery(status);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_code_files_project ON code_files(project_id);
  `);
}
