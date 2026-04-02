import Anthropic from '@anthropic-ai/sdk';
import type {
  ArchitectureAnalysis,
  Claim,
  ClaimVerdict,
  DetectedPattern,
  VerificationResult,
} from '../types.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 4096;

const SOCRATIC_SYSTEM_PROMPT = `You are a Socratic tutor. Your role is to guide learners to understanding through questions, never by giving away answers directly.

Rules:
- Extract factual claims from the student's message
- Verify each claim as correct, partial, or incorrect
- For correct claims: praise briefly and build on them
- For partial claims: acknowledge what's right, ask a guiding question about what's missing
- For incorrect claims: gently redirect without directly stating the answer — ask a question that leads them toward the right understanding
- Always end with a follow-up question that probes deeper understanding
- Be encouraging but honest

You MUST respond with valid JSON matching this schema:
{
  "claims": [
    {
      "text": "the claim extracted from the student's message",
      "verdict": "correct" | "partial" | "incorrect",
      "explanation": "brief explanation of why this verdict was given",
      "confidence": 0.0 to 1.0
    }
  ],
  "followUpQuestion": "a Socratic question to guide the student deeper"
}

If the student's message contains no verifiable claims (e.g., a greeting or question), return an empty claims array and respond with a guiding question to get them started.`;

const CONCEPT_NOTE_SYSTEM_PROMPT = `You are a knowledge synthesizer. Given a topic, verified claims about it, and the domain, generate a clean concept note in Markdown.

Structure the note with these sections:
## Definition
A clear, concise definition of the concept.

## Key Properties
Bullet points of the most important properties/characteristics.

## Examples
Concrete examples that illustrate the concept.

## Common Misconceptions
Frequent misunderstandings and their corrections.

## Related Concepts
Brief mentions of related topics for further study.

Write in a clear, direct academic style. Use the verified claims as source material but synthesize them into a coherent note — do not just list the claims.`;

const ARCHITECTURE_SYSTEM_PROMPT = `You are a code architecture analyst. Given a set of source files (path and content), analyze the codebase and return a JSON object matching this schema:

{
  "entryPoints": ["list of entry point file paths"],
  "dependencies": {
    "file/path.ts": ["dependency1.ts", "dependency2.ts"]
  },
  "patterns": [
    {
      "name": "pattern name (e.g., Repository Pattern, MVC, Observer)",
      "files": ["files implementing this pattern"],
      "description": "brief description of how the pattern is used"
    }
  ],
  "framework": "detected framework name or 'none'",
  "summary": "brief architectural summary of the codebase"
}

Detect design patterns, framework conventions, entry points, and module dependencies. Be specific and accurate — only report patterns you can clearly identify in the code.`;

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConversationEntry {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

interface RawClaimResponse {
  readonly text?: string;
  readonly verdict?: string;
  readonly explanation?: string;
  readonly confidence?: number;
}

interface RawVerificationResponse {
  readonly claims?: readonly RawClaimResponse[];
  readonly followUpQuestion?: string;
}

interface RawPatternResponse {
  readonly name?: string;
  readonly files?: readonly string[];
  readonly description?: string;
}

interface RawArchitectureResponse {
  readonly entryPoints?: readonly string[];
  readonly dependencies?: Record<string, readonly string[]>;
  readonly patterns?: readonly RawPatternResponse[];
  readonly framework?: string;
  readonly summary?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isValidVerdict(value: unknown): value is ClaimVerdict {
  return value === 'correct' || value === 'partial' || value === 'incorrect';
}

function parseClaim(raw: RawClaimResponse): Claim {
  return {
    text: typeof raw.text === 'string' ? raw.text : '',
    verdict: isValidVerdict(raw.verdict) ? raw.verdict : 'incorrect',
    explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
    confidence: typeof raw.confidence === 'number'
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0.5,
  };
}

function parseVerificationResult(raw: RawVerificationResponse): VerificationResult {
  const claims: readonly Claim[] = Array.isArray(raw.claims)
    ? raw.claims.map(parseClaim)
    : [];

  return {
    claims,
    followUpQuestion: typeof raw.followUpQuestion === 'string'
      ? raw.followUpQuestion
      : 'Can you tell me more about what you understand so far?',
    masteryUpdate: null,
    generatedNote: null,
  };
}

function parseArchitectureAnalysis(raw: RawArchitectureResponse): ArchitectureAnalysis {
  const patterns: readonly DetectedPattern[] = Array.isArray(raw.patterns)
    ? raw.patterns.map((p) => ({
        name: typeof p.name === 'string' ? p.name : 'Unknown',
        files: Array.isArray(p.files) ? p.files.filter((f: unknown): f is string => typeof f === 'string') : [],
        description: typeof p.description === 'string' ? p.description : '',
      }))
    : [];

  const dependencies: Record<string, readonly string[]> = {};
  if (raw.dependencies && typeof raw.dependencies === 'object') {
    for (const [key, value] of Object.entries(raw.dependencies)) {
      dependencies[key] = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string')
        : [];
    }
  }

  return {
    entryPoints: Array.isArray(raw.entryPoints)
      ? raw.entryPoints.filter((e): e is string => typeof e === 'string')
      : [],
    dependencies,
    patterns,
    framework: typeof raw.framework === 'string' ? raw.framework : 'none',
    summary: typeof raw.summary === 'string' ? raw.summary : '',
  };
}

function extractJsonFromText(text: string): string {
  // Try to find JSON in code fences first
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  // Try to find raw JSON object
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }
  return text;
}

function buildConversationMessages(
  history: readonly ConversationEntry[],
  userMessage: string,
  vaultContext?: string,
): Anthropic.MessageParam[] {
  const contextPrefix = vaultContext
    ? `[Vault context: ${vaultContext}]\n\n`
    : '';

  return [
    ...history.map((entry) => ({
      role: entry.role as 'user' | 'assistant',
      content: entry.content,
    })),
    {
      role: 'user' as const,
      content: `${contextPrefix}${userMessage}`,
    },
  ];
}

// ─── Client ─────────────────────────────────────────────────────────────────

export class ClaudeClient {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async verifyClaim(
    userMessage: string,
    conversationHistory: readonly ConversationEntry[],
    vaultContext?: string,
  ): Promise<VerificationResult> {
    const messages = buildConversationMessages(
      conversationHistory,
      userMessage,
      vaultContext,
    );

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: 'text',
            text: SOCRATIC_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages,
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        return {
          claims: [],
          followUpQuestion: 'Could you rephrase your answer? I had trouble understanding.',
          masteryUpdate: null,
          generatedNote: null,
        };
      }

      const jsonText = extractJsonFromText(textBlock.text);
      const parsed: unknown = JSON.parse(jsonText);
      return parseVerificationResult(parsed as RawVerificationResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Claude API error during claim verification: ${message}`);
    }
  }

  async generateConceptNote(
    topic: string,
    verifiedClaims: readonly Claim[],
    domain: string,
  ): Promise<string> {
    const claimsSummary = verifiedClaims
      .map((c) => `- [${c.verdict}] ${c.text} (${c.explanation})`)
      .join('\n');

    const userPrompt = `Topic: ${topic}
Domain: ${domain}

Verified claims from the study session:
${claimsSummary}

Please generate a concept note for this topic based on the verified claims above.`;

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: 'text',
            text: CONCEPT_NOTE_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userPrompt }],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      return textBlock.text;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Claude API error during concept note generation: ${message}`);
    }
  }

  async *streamVerifyClaim(
    userMessage: string,
    conversationHistory: readonly ConversationEntry[],
    vaultContext?: string,
  ): AsyncGenerator<string | VerificationResult> {
    const messages = buildConversationMessages(
      conversationHistory,
      userMessage,
      vaultContext,
    );

    try {
      const stream = this.client.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: 'text',
            text: SOCRATIC_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages,
      });

      let fullText = '';

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const token = event.delta.text;
          fullText += token;
          yield token;
        }
      }

      // Parse the complete response into a VerificationResult
      const jsonText = extractJsonFromText(fullText);
      const parsed: unknown = JSON.parse(jsonText);
      yield parseVerificationResult(parsed as RawVerificationResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Claude API streaming error: ${message}`);
    }
  }

  async analyzeCodeArchitecture(
    fileContents: ReadonlyMap<string, string>,
  ): Promise<ArchitectureAnalysis> {
    const MAX_FILES = 100;
    const MAX_FILE_BYTES = 50_000;

    const fileDescriptions = Array.from(fileContents.entries())
      .slice(0, MAX_FILES)
      .map(([filePath, content]) => {
        const safePath = filePath.replace(/---/g, '—');
        const safeContent = content.slice(0, MAX_FILE_BYTES);
        return `--- ${safePath} ---\n${safeContent}`;
      })
      .join('\n\n');

    const userPrompt = `Analyze the following codebase and return the architecture analysis as JSON.

${fileDescriptions}`;

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: 'text',
            text: ARCHITECTURE_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userPrompt }],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      const jsonText = extractJsonFromText(textBlock.text);
      const parsed: unknown = JSON.parse(jsonText);
      return parseArchitectureAnalysis(parsed as RawArchitectureResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Claude API error during architecture analysis: ${message}`);
    }
  }
}
