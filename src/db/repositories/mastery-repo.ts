import type Database from 'better-sqlite3';
import type { MasteryRecord, ConceptStatus } from '../../types.js';

// ─── Row shape returned by SQLite ───────────────────────────────────────────

interface MasteryRow {
  readonly id: string;
  readonly domain: string;
  readonly status: string;
  readonly stability: number;
  readonly difficulty: number;
  readonly retrievability: number;
  readonly review_due: string;
  readonly times_reviewed: number;
  readonly times_correct: number;
  readonly streak: number;
  readonly last_reviewed: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function rowToRecord(row: MasteryRow): MasteryRecord {
  return {
    id: row.id,
    domain: row.domain,
    status: row.status as ConceptStatus,
    stability: row.stability,
    difficulty: row.difficulty,
    retrievability: row.retrievability,
    reviewDue: row.review_due,
    timesReviewed: row.times_reviewed,
    timesCorrect: row.times_correct,
    streak: row.streak,
    lastReviewed: row.last_reviewed,
    createdAt: row.created_at,
  };
}

function now(): string {
  return new Date().toISOString();
}

// ─── Repository Functions ───────────────────────────────────────────────────

/**
 * Insert a new mastery record. If createdAt is not provided, the current
 * timestamp is used.
 */
export function createMastery(
  db: Database.Database,
  record: Omit<MasteryRecord, 'createdAt'> & { createdAt?: string },
): MasteryRecord {
  const createdAt = record.createdAt ?? now();
  const updatedAt = now();

  const stmt = db.prepare(`
    INSERT INTO mastery (
      id, domain, status, stability, difficulty, retrievability,
      review_due, times_reviewed, times_correct, streak,
      last_reviewed, created_at, updated_at
    ) VALUES (
      @id, @domain, @status, @stability, @difficulty, @retrievability,
      @reviewDue, @timesReviewed, @timesCorrect, @streak,
      @lastReviewed, @createdAt, @updatedAt
    )
  `);

  stmt.run({
    id: record.id,
    domain: record.domain,
    status: record.status,
    stability: record.stability,
    difficulty: record.difficulty,
    retrievability: record.retrievability,
    reviewDue: record.reviewDue,
    timesReviewed: record.timesReviewed,
    timesCorrect: record.timesCorrect,
    streak: record.streak,
    lastReviewed: record.lastReviewed,
    createdAt,
    updatedAt,
  });

  return {
    id: record.id,
    domain: record.domain,
    status: record.status,
    stability: record.stability,
    difficulty: record.difficulty,
    retrievability: record.retrievability,
    reviewDue: record.reviewDue,
    timesReviewed: record.timesReviewed,
    timesCorrect: record.timesCorrect,
    streak: record.streak,
    lastReviewed: record.lastReviewed,
    createdAt,
  };
}

/**
 * Retrieve a single mastery record by id, or null if not found.
 */
export function getMastery(
  db: Database.Database,
  id: string,
): MasteryRecord | null {
  const stmt = db.prepare('SELECT * FROM mastery WHERE id = ?');
  const row = stmt.get(id) as MasteryRow | undefined;
  return row ? rowToRecord(row) : null;
}

/**
 * Update specific fields on a mastery record. Returns a new MasteryRecord
 * reflecting the updated state. Never mutates the input.
 */
export function updateMastery(
  db: Database.Database,
  id: string,
  updates: Partial<MasteryRecord>,
): MasteryRecord | null {
  const existing = getMastery(db, id);
  if (existing === null) {
    return null;
  }

  // Build the merged record (new object, never mutate)
  const merged = {
    ...existing,
    ...updates,
    id: existing.id, // id is immutable
  };

  const updatedAt = now();

  const stmt = db.prepare(`
    UPDATE mastery SET
      domain = @domain,
      status = @status,
      stability = @stability,
      difficulty = @difficulty,
      retrievability = @retrievability,
      review_due = @reviewDue,
      times_reviewed = @timesReviewed,
      times_correct = @timesCorrect,
      streak = @streak,
      last_reviewed = @lastReviewed,
      updated_at = @updatedAt
    WHERE id = @id
  `);

  stmt.run({
    id: merged.id,
    domain: merged.domain,
    status: merged.status,
    stability: merged.stability,
    difficulty: merged.difficulty,
    retrievability: merged.retrievability,
    reviewDue: merged.reviewDue,
    timesReviewed: merged.timesReviewed,
    timesCorrect: merged.timesCorrect,
    streak: merged.streak,
    lastReviewed: merged.lastReviewed,
    updatedAt,
  });

  return { ...merged };
}

/**
 * List mastery records with optional filters, sorted by review_due ascending.
 */
export function listMastery(
  db: Database.Database,
  filters?: { domain?: string; status?: string; dueBefore?: string },
): readonly MasteryRecord[] {
  const conditions: string[] = [];
  const params: Record<string, string> = {};

  if (filters?.domain) {
    conditions.push('domain = @domain');
    params.domain = filters.domain;
  }
  if (filters?.status) {
    conditions.push('status = @status');
    params.status = filters.status;
  }
  if (filters?.dueBefore) {
    conditions.push('review_due <= @dueBefore');
    params.dueBefore = filters.dueBefore;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = db.prepare(`SELECT * FROM mastery ${where} ORDER BY review_due ASC`);
  const rows = stmt.all(params) as MasteryRow[];

  return rows.map(rowToRecord);
}

/**
 * Return all mastery records whose review is due (review_due <= now),
 * sorted by review_due ascending.
 */
export function getDueForReview(
  db: Database.Database,
): readonly MasteryRecord[] {
  const stmt = db.prepare(
    'SELECT * FROM mastery WHERE review_due <= @now ORDER BY review_due ASC',
  );
  const rows = stmt.all({ now: now() }) as MasteryRow[];
  return rows.map(rowToRecord);
}

/**
 * Delete a mastery record by id.
 */
export function deleteMastery(
  db: Database.Database,
  id: string,
): void {
  const stmt = db.prepare('DELETE FROM mastery WHERE id = ?');
  stmt.run(id);
}

/**
 * Aggregate statistics across all mastery records.
 */
export function getMasteryStats(
  db: Database.Database,
): {
  readonly total: number;
  readonly mastered: number;
  readonly learning: number;
  readonly draft: number;
  readonly dueToday: number;
} {
  const countStmt = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'mastered' THEN 1 ELSE 0 END) AS mastered,
      SUM(CASE WHEN status = 'learning' THEN 1 ELSE 0 END) AS learning,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft
    FROM mastery
  `);

  const counts = countStmt.get() as {
    total: number;
    mastered: number;
    learning: number;
    draft: number;
  };

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayEndStr = todayEnd.toISOString();

  const dueStmt = db.prepare(
    'SELECT COUNT(*) AS due_today FROM mastery WHERE review_due <= ?',
  );
  const { due_today: dueToday } = dueStmt.get(todayEndStr) as { due_today: number };

  return {
    total: counts.total,
    mastered: counts.mastered,
    learning: counts.learning,
    draft: counts.draft,
    dueToday,
  };
}
