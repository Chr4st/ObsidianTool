// ─── Core Domain Types ───────────────────────────────────────────────────────

export type ConceptStatus = 'draft' | 'learning' | 'mastered';
export type ClaimVerdict = 'correct' | 'partial' | 'incorrect';
export type ConversationOutcome = 'mastered' | 'partial' | 'abandoned';
export type MessageRole = 'user' | 'assistant' | 'system';

// ─── Config ──────────────────────────────────────────────────────────────────

export interface StudyConfig {
  readonly vault_path: string;
  readonly anthropic_api_key: string;
  readonly voyage_api_key: string;
  readonly default_domain: string;
  readonly mastery_threshold: number;
  readonly streak_threshold: number;
}

// ─── Frontmatter ─────────────────────────────────────────────────────────────

export interface ConceptFrontmatter {
  readonly type: 'concept';
  readonly status: ConceptStatus;
  readonly domain: string;
  readonly tags: readonly string[];
  readonly related: readonly string[];
  readonly source_conversation?: string;
  readonly fsrs_stability: number;
  readonly fsrs_difficulty: number;
  readonly fsrs_retrievability: number;
  readonly review_due: string;
  readonly times_reviewed: number;
  readonly created_at: string;
}

export interface CodeAnalysisFrontmatter {
  readonly type: 'code-analysis';
  readonly project_path: string;
  readonly analyzed_date: string;
  readonly language: string;
  readonly framework: string;
  readonly patterns_detected: readonly string[];
  readonly entry_points: readonly string[];
  readonly file_count: number;
  readonly loc: number;
}

// ─── Socratic Engine ─────────────────────────────────────────────────────────

export interface Claim {
  readonly text: string;
  readonly verdict: ClaimVerdict;
  readonly explanation: string;
  readonly confidence: number;
}

export interface VerificationResult {
  readonly claims: readonly Claim[];
  readonly followUpQuestion: string;
  readonly masteryUpdate: MasteryUpdate | null;
  readonly generatedNote: GeneratedNote | null;
}

export interface MasteryUpdate {
  readonly conceptId: string;
  readonly newScore: number;
  readonly status: ConceptStatus;
  readonly streakCount: number;
}

export interface GeneratedNote {
  readonly path: string;
  readonly content: string;
  readonly frontmatter: ConceptFrontmatter;
}

// ─── Conversation ────────────────────────────────────────────────────────────

export interface ConversationMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly claims: readonly Claim[];
  readonly createdAt: string;
}

export interface Conversation {
  readonly id: string;
  readonly topic: string;
  readonly domain: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly outcome: ConversationOutcome | null;
  readonly messageCount: number;
}

// ─── Mastery / FSRS ─────────────────────────────────────────────────────────

export interface MasteryRecord {
  readonly id: string;
  readonly domain: string;
  readonly status: ConceptStatus;
  readonly stability: number;
  readonly difficulty: number;
  readonly retrievability: number;
  readonly reviewDue: string;
  readonly timesReviewed: number;
  readonly timesCorrect: number;
  readonly streak: number;
  readonly lastReviewed: string | null;
  readonly createdAt: string;
}

// ─── Code Analysis ───────────────────────────────────────────────────────────

export interface CodeProject {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly language: string;
  readonly framework: string;
  readonly patterns: readonly string[];
  readonly lastAnalyzed: string;
  readonly fileCount: number;
  readonly loc: number;
}

export interface CodeFile {
  readonly id: number;
  readonly projectId: string;
  readonly relativePath: string;
  readonly language: string;
  readonly loc: number;
  readonly lastModified: string;
  readonly hash: string;
}

export interface ArchitectureAnalysis {
  readonly entryPoints: readonly string[];
  readonly dependencies: Record<string, readonly string[]>;
  readonly patterns: readonly DetectedPattern[];
  readonly framework: string;
  readonly summary: string;
}

export interface DetectedPattern {
  readonly name: string;
  readonly files: readonly string[];
  readonly description: string;
}

// ─── Search ──────────────────────────────────────────────────────────────────

export type SearchResultType = 'concept' | 'conversation' | 'code';

export interface SearchResult {
  readonly type: SearchResultType;
  readonly source: string;
  readonly chunk: string;
  readonly score: number;
}

// ─── Chat Display ────────────────────────────────────────────────────────────

export interface ChatMessage {
  readonly role: MessageRole;
  readonly content: string;
  readonly claims?: readonly Claim[];
  readonly timestamp: string;
}
