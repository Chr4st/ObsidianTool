import type { Claim, ClaimVerdict } from '../types.js';
import type { ClaudeClient } from './claude-client.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TurnResult {
  readonly response: string;
  readonly claims: readonly Claim[];
  readonly followUp: string;
  readonly masteryReached: boolean;
  readonly currentScore: number;
  readonly streak: number;
}

export interface ConversationSummary {
  readonly conversationId: string;
  readonly topic: string;
  readonly domain: string;
  readonly totalClaims: number;
  readonly correctClaims: number;
  readonly partialClaims: number;
  readonly incorrectClaims: number;
  readonly finalScore: number;
  readonly finalStreak: number;
  readonly masteryReached: boolean;
  readonly allClaims: readonly Claim[];
}

interface ConversationState {
  readonly conversationId: string;
  readonly topic: string;
  readonly domain: string;
  readonly allClaims: readonly Claim[];
  readonly correctCount: number;
  readonly partialCount: number;
  readonly incorrectCount: number;
  readonly currentStreak: number;
  readonly history: readonly ConversationEntry[];
}

interface ConversationEntry {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function countByVerdict(
  claims: readonly Claim[],
  verdict: ClaimVerdict,
): number {
  return claims.filter((c) => c.verdict === verdict).length;
}

function computeMasteryScore(
  correctClaims: number,
  totalClaims: number,
  streak: number,
  streakThreshold: number,
): number {
  if (totalClaims === 0) {
    return 0;
  }
  const accuracy = correctClaims / totalClaims;
  const streakBonus = Math.min(streak / streakThreshold, 1.0);
  return accuracy * streakBonus;
}

function formatClaimFeedback(claim: Claim): string {
  const icon = claim.verdict === 'correct'
    ? '[correct]'
    : claim.verdict === 'partial'
      ? '[partial]'
      : '[incorrect]';
  return `${icon} "${claim.text}" -- ${claim.explanation}`;
}

function formatResponse(claims: readonly Claim[], followUp: string): string {
  if (claims.length === 0) {
    return followUp;
  }
  const feedback = claims.map(formatClaimFeedback).join('\n');
  return `${feedback}\n\n${followUp}`;
}

function computeNewStreak(
  currentStreak: number,
  newClaims: readonly Claim[],
): number {
  // If all new claims are correct, extend streak.
  // If any claim is incorrect, reset to 0.
  // Partial claims do not break the streak but do not extend it.
  const hasIncorrect = newClaims.some((c) => c.verdict === 'incorrect');
  if (hasIncorrect) {
    return 0;
  }
  const correctCount = newClaims.filter((c) => c.verdict === 'correct').length;
  return currentStreak + correctCount;
}

function createInitialState(
  conversationId: string,
  topic: string,
  domain: string,
): ConversationState {
  return {
    conversationId,
    topic,
    domain,
    allClaims: [],
    correctCount: 0,
    partialCount: 0,
    incorrectCount: 0,
    currentStreak: 0,
    history: [],
  };
}

// ─── Engine ─────────────────────────────────────────────────────────────────

export class SocraticEngine {
  private readonly claudeClient: ClaudeClient;
  private readonly masteryThreshold: number;
  private readonly streakThreshold: number;
  private state: ConversationState | null;

  constructor(
    claudeClient: ClaudeClient,
    masteryThreshold: number,
    streakThreshold: number,
  ) {
    this.claudeClient = claudeClient;
    this.masteryThreshold = masteryThreshold;
    this.streakThreshold = streakThreshold;
    this.state = null;
  }

  startConversation(topic: string, domain: string): string {
    const conversationId = generateId();
    this.state = createInitialState(conversationId, topic, domain);
    return conversationId;
  }

  async processMessage(userMessage: string): Promise<TurnResult> {
    if (!this.state) {
      throw new Error(
        'No active conversation. Call startConversation() first.',
      );
    }

    const currentState = this.state;

    const vaultContext = `Topic: ${currentState.topic}, Domain: ${currentState.domain}`;

    const result = await this.claudeClient.verifyClaim(
      userMessage,
      currentState.history,
      vaultContext,
    );

    const newClaims = result.claims;
    const newStreak = computeNewStreak(currentState.currentStreak, newClaims);
    const newCorrect = currentState.correctCount + countByVerdict(newClaims, 'correct');
    const newPartial = currentState.partialCount + countByVerdict(newClaims, 'partial');
    const newIncorrect = currentState.incorrectCount + countByVerdict(newClaims, 'incorrect');
    const allClaims = [...currentState.allClaims, ...newClaims];
    const totalClaims = allClaims.length;

    const score = computeMasteryScore(
      newCorrect,
      totalClaims,
      newStreak,
      this.streakThreshold,
    );

    const responseText = formatResponse(newClaims, result.followUpQuestion);

    // Build new history immutably
    const updatedHistory: readonly ConversationEntry[] = [
      ...currentState.history,
      { role: 'user' as const, content: userMessage },
      { role: 'assistant' as const, content: responseText },
    ];

    // Replace state with new immutable snapshot
    this.state = {
      conversationId: currentState.conversationId,
      topic: currentState.topic,
      domain: currentState.domain,
      allClaims,
      correctCount: newCorrect,
      partialCount: newPartial,
      incorrectCount: newIncorrect,
      currentStreak: newStreak,
      history: updatedHistory,
    };

    const masteryReached = this.checkMastery();

    return {
      response: responseText,
      claims: newClaims,
      followUp: result.followUpQuestion,
      masteryReached,
      currentScore: score,
      streak: newStreak,
    };
  }

  checkMastery(): boolean {
    if (!this.state) {
      return false;
    }
    const totalClaims = this.state.allClaims.length;
    if (totalClaims === 0) {
      return false;
    }
    const score = computeMasteryScore(
      this.state.correctCount,
      totalClaims,
      this.state.currentStreak,
      this.streakThreshold,
    );
    return score >= this.masteryThreshold && this.state.currentStreak >= this.streakThreshold;
  }

  getConversationSummary(): ConversationSummary {
    if (!this.state) {
      throw new Error(
        'No active conversation. Call startConversation() first.',
      );
    }

    const totalClaims = this.state.allClaims.length;
    const score = computeMasteryScore(
      this.state.correctCount,
      totalClaims,
      this.state.currentStreak,
      this.streakThreshold,
    );

    return {
      conversationId: this.state.conversationId,
      topic: this.state.topic,
      domain: this.state.domain,
      totalClaims,
      correctClaims: this.state.correctCount,
      partialClaims: this.state.partialCount,
      incorrectClaims: this.state.incorrectCount,
      finalScore: score,
      finalStreak: this.state.currentStreak,
      masteryReached: this.checkMastery(),
      allClaims: this.state.allClaims,
    };
  }

  reset(): void {
    this.state = null;
  }
}
