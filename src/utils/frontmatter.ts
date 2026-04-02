import matter from 'gray-matter';
import type {
  ConceptFrontmatter,
  CodeAnalysisFrontmatter,
} from '../types.js';

// ─── Parsing ────────────────────────────────────────────────────────────────

export interface ParsedFrontmatter<T> {
  readonly frontmatter: T;
  readonly content: string;
}

/**
 * Parses a markdown string with YAML frontmatter.
 * Returns the typed frontmatter object and the body content.
 */
export function parseFrontmatter<T>(markdown: string): ParsedFrontmatter<T> {
  const { data, content } = matter(markdown);
  return {
    frontmatter: data as T,
    content: content.trim(),
  };
}

// ─── Generation ─────────────────────────────────────────────────────────────

/**
 * Combines a frontmatter object and body content into a complete markdown
 * string with YAML frontmatter delimiters.
 */
export function generateFrontmatter(
  frontmatterObj: Record<string, unknown>,
  body: string,
): string {
  return matter.stringify(body, frontmatterObj);
}

// ─── Factory: ConceptFrontmatter ────────────────────────────────────────────

interface CreateConceptInput {
  readonly topic: string;
  readonly domain: string;
  readonly tags: readonly string[];
}

/**
 * Creates a complete ConceptFrontmatter with sensible defaults.
 * Pure function -- returns a new object every time.
 */
export function createConceptFrontmatter(
  input: CreateConceptInput,
): ConceptFrontmatter {
  const now = new Date();
  const reviewDue = new Date(now);
  reviewDue.setDate(reviewDue.getDate() + 1);

  return {
    type: 'concept',
    status: 'mastered',
    domain: input.domain,
    tags: [...input.tags],
    related: [],
    source_conversation: undefined,
    fsrs_stability: 1.0,
    fsrs_difficulty: 0.3,
    fsrs_retrievability: 1.0,
    review_due: reviewDue.toISOString(),
    times_reviewed: 0,
    created_at: now.toISOString(),
  };
}

// ─── Factory: CodeAnalysisFrontmatter ───────────────────────────────────────

interface CreateCodeAnalysisInput {
  readonly projectPath: string;
  readonly language: string;
  readonly framework: string;
  readonly patternsDetected: readonly string[];
  readonly entryPoints: readonly string[];
  readonly fileCount: number;
  readonly loc: number;
}

/**
 * Creates a complete CodeAnalysisFrontmatter with sensible defaults.
 * Pure function -- returns a new object every time.
 */
export function createCodeAnalysisFrontmatter(
  input: CreateCodeAnalysisInput,
): CodeAnalysisFrontmatter {
  return {
    type: 'code-analysis',
    project_path: input.projectPath,
    analyzed_date: new Date().toISOString(),
    language: input.language,
    framework: input.framework,
    patterns_detected: [...input.patternsDetected],
    entry_points: [...input.entryPoints],
    file_count: input.fileCount,
    loc: input.loc,
  };
}

// ─── Field Update ───────────────────────────────────────────────────────────

/**
 * Returns a new markdown string with a single frontmatter field updated.
 * Immutable: the original string is not modified.
 */
export function updateFrontmatterField(
  markdown: string,
  field: string,
  value: unknown,
): string {
  const { data, content } = matter(markdown);

  // Build a new frontmatter object instead of mutating
  const updated = { ...data, [field]: value };

  return matter.stringify(content, updated);
}
