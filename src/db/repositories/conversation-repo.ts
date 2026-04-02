import type Database from 'better-sqlite3';
import type {
  Conversation,
  ConversationMessage,
  ConversationOutcome,
  MessageRole,
  Claim,
} from '../../types.js';

// ─── Row shapes returned by SQLite ──────────────────────────────────────────

interface ConversationRow {
  readonly id: string;
  readonly topic: string;
  readonly domain: string;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly outcome: string | null;
  readonly message_count: number;
}

interface MessageRow {
  readonly id: number;
  readonly conversation_id: string;
  readonly role: string;
  readonly content: string;
  readonly claims_json: string | null;
  readonly created_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function rowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    topic: row.topic,
    domain: row.domain,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    outcome: row.outcome as ConversationOutcome | null,
    messageCount: row.message_count,
  };
}

function parseClaims(json: string | null): readonly Claim[] {
  if (json === null || json === '') {
    return [];
  }
  try {
    return JSON.parse(json) as Claim[];
  } catch {
    return [];
  }
}

function rowToMessage(row: MessageRow): ConversationMessage {
  return {
    id: String(row.id),
    conversationId: row.conversation_id,
    role: row.role as MessageRole,
    content: row.content,
    claims: parseClaims(row.claims_json),
    createdAt: row.created_at,
  };
}

// ─── Repository Functions ───────────────────────────────────────────────────

/**
 * Create a new conversation record.
 */
export function createConversation(
  db: Database.Database,
  conv: Omit<Conversation, 'messageCount'>,
): Conversation {
  const stmt = db.prepare(`
    INSERT INTO conversations (id, topic, domain, started_at, ended_at, outcome, message_count)
    VALUES (@id, @topic, @domain, @startedAt, @endedAt, @outcome, 0)
  `);

  stmt.run({
    id: conv.id,
    topic: conv.topic,
    domain: conv.domain,
    startedAt: conv.startedAt,
    endedAt: conv.endedAt,
    outcome: conv.outcome,
  });

  return {
    id: conv.id,
    topic: conv.topic,
    domain: conv.domain,
    startedAt: conv.startedAt,
    endedAt: conv.endedAt,
    outcome: conv.outcome,
    messageCount: 0,
  };
}

/**
 * Retrieve a conversation by id, or null if not found.
 */
export function getConversation(
  db: Database.Database,
  id: string,
): Conversation | null {
  const stmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
  const row = stmt.get(id) as ConversationRow | undefined;
  return row ? rowToConversation(row) : null;
}

/**
 * Update specific fields on a conversation. Returns the updated conversation
 * as a new object.
 */
export function updateConversation(
  db: Database.Database,
  id: string,
  updates: Partial<Conversation>,
): Conversation | null {
  const existing = getConversation(db, id);
  if (existing === null) {
    return null;
  }

  const merged = {
    ...existing,
    ...updates,
    id: existing.id, // id is immutable
  };

  const stmt = db.prepare(`
    UPDATE conversations SET
      topic = @topic,
      domain = @domain,
      started_at = @startedAt,
      ended_at = @endedAt,
      outcome = @outcome,
      message_count = @messageCount
    WHERE id = @id
  `);

  stmt.run({
    id: merged.id,
    topic: merged.topic,
    domain: merged.domain,
    startedAt: merged.startedAt,
    endedAt: merged.endedAt,
    outcome: merged.outcome,
    messageCount: merged.messageCount,
  });

  return { ...merged };
}

/**
 * Add a message to a conversation. Increments the conversation's
 * message_count. Returns the message with a generated string id.
 */
export function addMessage(
  db: Database.Database,
  msg: Omit<ConversationMessage, 'id'>,
): ConversationMessage {
  const claimsJson = msg.claims.length > 0 ? JSON.stringify(msg.claims) : null;

  const insertStmt = db.prepare(`
    INSERT INTO messages (conversation_id, role, content, claims_json, created_at)
    VALUES (@conversationId, @role, @content, @claimsJson, @createdAt)
  `);

  const incrementStmt = db.prepare(`
    UPDATE conversations SET message_count = message_count + 1 WHERE id = ?
  `);

  const insertAndIncrement = db.transaction(() => {
    const result = insertStmt.run({
      conversationId: msg.conversationId,
      role: msg.role,
      content: msg.content,
      claimsJson,
      createdAt: msg.createdAt,
    });

    incrementStmt.run(msg.conversationId);

    return result.lastInsertRowid;
  });

  const rowId = insertAndIncrement();

  return {
    id: String(rowId),
    conversationId: msg.conversationId,
    role: msg.role,
    content: msg.content,
    claims: [...msg.claims],
    createdAt: msg.createdAt,
  };
}

/**
 * Retrieve all messages for a conversation, ordered by created_at ascending.
 */
export function getMessages(
  db: Database.Database,
  conversationId: string,
): readonly ConversationMessage[] {
  const stmt = db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
  );
  const rows = stmt.all(conversationId) as MessageRow[];
  return rows.map(rowToMessage);
}

/**
 * Retrieve the most recent conversations, ordered by started_at descending.
 */
export function getRecentConversations(
  db: Database.Database,
  limit: number = 20,
): readonly Conversation[] {
  const stmt = db.prepare(
    'SELECT * FROM conversations ORDER BY started_at DESC LIMIT ?',
  );
  const rows = stmt.all(limit) as ConversationRow[];
  return rows.map(rowToConversation);
}
