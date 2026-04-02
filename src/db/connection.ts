import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { initSchema } from './schema.js';

const STUDY_DIR = join(homedir(), '.study');
const DB_FILENAME = 'study.db';

let database: Database.Database | null = null;

/**
 * Returns the absolute path to the database file.
 */
export function getDatabasePath(): string {
  return join(STUDY_DIR, DB_FILENAME);
}

/**
 * Returns the singleton Database instance, creating it on first call.
 * - Creates ~/.study/ directory if it does not exist
 * - Creates the SQLite database file if it does not exist
 * - Enables WAL mode for better concurrent read performance
 * - Runs schema migrations on first connection
 */
export function getDatabase(): Database.Database {
  if (database !== null) {
    return database;
  }

  mkdirSync(STUDY_DIR, { recursive: true });

  const dbPath = getDatabasePath();
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);

  database = db;
  return database;
}

/**
 * Closes the database connection and resets the singleton.
 */
export function closeDatabase(): void {
  if (database !== null) {
    database.close();
    database = null;
  }
}
