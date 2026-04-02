import type { Claim, ArchitectureAnalysis } from '../types.js';
import {
  createConceptFrontmatter,
  createCodeAnalysisFrontmatter,
  generateFrontmatter,
} from '../utils/frontmatter.js';
import type { VaultWriter } from './vault-writer.js';

// ─── Slug Utility ───────────────────────────────────────────────────────────

/**
 * Converts a human-readable title into a URL/filename-safe slug.
 *   "Binary Search Algorithm" -> "binary-search-algorithm"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric runs with hyphens
    .replace(/^-+|-+$/g, '');     // strip leading/trailing hyphens
}

// ─── NoteGenerator ──────────────────────────────────────────────────────────

export class NoteGenerator {
  private readonly writer: VaultWriter;

  constructor(writer: VaultWriter) {
    this.writer = writer;
  }

  // ── Concept Notes ─────────────────────────────────────────────────────

  /**
   * Generates a concept note from a Socratic conversation and writes it
   * to the vault.  Returns the absolute path of the written file.
   */
  async generateConceptNote(
    topic: string,
    domain: string,
    verifiedClaims: readonly Claim[],
    aiContent: string,
    tags: readonly string[],
  ): Promise<string> {
    const slug = slugify(topic);
    const relativePath = await this.findAvailablePath(
      'notes/concepts',
      slug,
    );

    const frontmatter = createConceptFrontmatter({ topic, domain, tags });
    const body = this.buildConceptBody(topic, verifiedClaims, aiContent);
    const content = generateFrontmatter(
      frontmatter as unknown as Record<string, unknown>,
      body,
    );

    return this.writer.writeNote(relativePath, content);
  }

  // ── Code Analysis Notes ───────────────────────────────────────────────

  /**
   * Generates architecture and pattern notes for a code project.
   * Writes two files:
   *   code-projects/{project-slug}/_architecture.md
   *   code-projects/{project-slug}/_patterns.md
   * Returns an array of the absolute paths written.
   */
  async generateCodeAnalysisNote(
    projectName: string,
    analysis: ArchitectureAnalysis,
    projectPath: string,
  ): Promise<readonly string[]> {
    const projectSlug = slugify(projectName);
    const baseDir = `code-projects/${projectSlug}`;

    const architecturePath = `${baseDir}/_architecture.md`;
    const patternsPath = `${baseDir}/_patterns.md`;

    const archContent = this.buildArchitectureContent(
      projectName,
      analysis,
      projectPath,
    );
    const patternsContent = this.buildPatternsContent(
      projectName,
      analysis,
      projectPath,
    );

    const [archAbsolute, patternsAbsolute] = await Promise.all([
      this.writer.writeNote(architecturePath, archContent),
      this.writer.writeNote(patternsPath, patternsContent),
    ]);

    return [archAbsolute, patternsAbsolute];
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Finds an available filename by appending a numeric suffix when the
   * base name already exists.
   */
  private async findAvailablePath(
    directory: string,
    slug: string,
  ): Promise<string> {
    const basePath = `${directory}/${slug}.md`;

    if (!(await this.writer.noteExists(basePath))) {
      return basePath;
    }

    let counter = 1;
    while (true) {
      const candidate = `${directory}/${slug}-${counter}.md`;
      if (!(await this.writer.noteExists(candidate))) {
        return candidate;
      }
      counter += 1;
    }
  }

  /** Builds the markdown body for a concept note. */
  private buildConceptBody(
    topic: string,
    verifiedClaims: readonly Claim[],
    aiContent: string,
  ): string {
    const sections: string[] = [];

    sections.push(`# ${topic}`);
    sections.push('');
    sections.push(aiContent);

    if (verifiedClaims.length > 0) {
      sections.push('');
      sections.push('## Verified Claims');
      sections.push('');

      for (const claim of verifiedClaims) {
        const icon = verdictIcon(claim.verdict);
        sections.push(`- ${icon} **${claim.text}**`);
        sections.push(`  ${claim.explanation}`);
      }
    }

    return sections.join('\n');
  }

  /** Builds the full markdown content (frontmatter + body) for _architecture.md. */
  private buildArchitectureContent(
    projectName: string,
    analysis: ArchitectureAnalysis,
    projectPath: string,
  ): string {
    const fm = createCodeAnalysisFrontmatter({
      projectPath,
      language: '',
      framework: analysis.framework,
      patternsDetected: analysis.patterns.map((p) => p.name),
      entryPoints: [...analysis.entryPoints],
      fileCount: 0,
      loc: 0,
    });

    const body = [
      `# ${projectName} -- Architecture`,
      '',
      analysis.summary,
      '',
      '## Entry Points',
      '',
      ...analysis.entryPoints.map((ep) => `- \`${ep}\``),
      '',
      '## Dependencies',
      '',
      ...Object.entries(analysis.dependencies).map(
        ([mod, deps]) =>
          `- **${mod}**: ${(deps as readonly string[]).join(', ')}`,
      ),
    ].join('\n');

    return generateFrontmatter(
      fm as unknown as Record<string, unknown>,
      body,
    );
  }

  /** Builds the full markdown content (frontmatter + body) for _patterns.md. */
  private buildPatternsContent(
    projectName: string,
    analysis: ArchitectureAnalysis,
    projectPath: string,
  ): string {
    const fm = createCodeAnalysisFrontmatter({
      projectPath,
      language: '',
      framework: analysis.framework,
      patternsDetected: analysis.patterns.map((p) => p.name),
      entryPoints: [...analysis.entryPoints],
      fileCount: 0,
      loc: 0,
    });

    const patternSections: string[] = [];
    for (const pattern of analysis.patterns) {
      patternSections.push(`### ${pattern.name}`);
      patternSections.push('');
      patternSections.push(pattern.description);
      patternSections.push('');
      patternSections.push('Files:');
      for (const file of pattern.files) {
        patternSections.push(`- \`${file}\``);
      }
      patternSections.push('');
    }

    const body = [
      `# ${projectName} -- Detected Patterns`,
      '',
      ...patternSections,
    ].join('\n');

    return generateFrontmatter(
      fm as unknown as Record<string, unknown>,
      body,
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function verdictIcon(verdict: string): string {
  switch (verdict) {
    case 'correct':
      return '[v]';
    case 'partial':
      return '[~]';
    case 'incorrect':
      return '[x]';
    default:
      return '[ ]';
  }
}
