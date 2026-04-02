// ─── Math & Message Renderer Components (Ink / React) ───────────────────────
//
// Ink components for displaying LaTeX math and chat messages in the TUI.
// ─────────────────────────────────────────────────────────────────────────────

import chalk from 'chalk';
import { Box, Text } from 'ink';
import React from 'react';

import type { Claim } from '../types.js';

import { renderLatex } from '../services/latex-renderer.js';
import { renderMarkdownWithLatex } from '../services/markdown-renderer.js';

// ─── Verdict Symbols ────────────────────────────────────────────────────────

const VERDICT_CORRECT = chalk.green('\u2713');
const VERDICT_PARTIAL = chalk.yellow('\u25D0');
const VERDICT_INCORRECT = chalk.red('\u2717');

const verdictSymbol = (verdict: Claim['verdict']): string => {
  switch (verdict) {
    case 'correct':
      return VERDICT_CORRECT;
    case 'partial':
      return VERDICT_PARTIAL;
    case 'incorrect':
      return VERDICT_INCORRECT;
  }
};

// ─── MathRenderer ───────────────────────────────────────────────────────────

interface MathRendererProps {
  readonly latex: string;
}

/**
 * Renders a LaTeX expression as Unicode text inside an Ink `Text` node.
 */
export const MathRenderer: React.FC<MathRendererProps> = ({ latex }) => {
  const rendered = renderLatex(latex);
  return <Text>{rendered}</Text>;
};

// ─── MessageRenderer ────────────────────────────────────────────────────────

interface MessageRendererProps {
  readonly content: string;
  readonly role: 'user' | 'assistant';
  readonly claims?: readonly Claim[];
}

/**
 * Renders a chat message.
 *
 * - **Assistant** messages are processed through full Markdown + LaTeX
 *   rendering, with optional claim verdicts displayed beneath.
 * - **User** messages receive light styling only.
 */
export const MessageRenderer: React.FC<MessageRendererProps> = ({
  content,
  role,
  claims,
}) => {
  if (role === 'user') {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">
          You:
        </Text>
        <Text>{content}</Text>
      </Box>
    );
  }

  // Assistant message — full Markdown + LaTeX rendering
  const rendered = renderMarkdownWithLatex(content);

  return (
    <Box flexDirection="column">
      <Text bold color="magenta">
        Assistant:
      </Text>
      <Text>{rendered}</Text>

      {claims && claims.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {claims.map((claim, index) => (
            <Text key={index}>
              {verdictSymbol(claim.verdict)} {claim.text}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};
