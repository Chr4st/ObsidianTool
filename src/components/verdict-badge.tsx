// ─── Verdict Badge Component (Ink / React) ──────────────────────────────────
//
// Compact inline badge for displaying claim verdicts in the TUI.
// ─────────────────────────────────────────────────────────────────────────────

import { Text } from 'ink';
import React from 'react';

import type { ClaimVerdict } from '../types.js';

// ─── Constants ──────────────────────────────────────────────────────────────

interface VerdictStyle {
  readonly symbol: string;
  readonly color: 'green' | 'yellow' | 'red';
  readonly label: string;
}

const VERDICT_STYLES: Readonly<Record<ClaimVerdict, VerdictStyle>> = {
  correct: { symbol: '\u2713', color: 'green', label: 'Correct' },
  partial: { symbol: '\u25D0', color: 'yellow', label: 'Partial' },
  incorrect: { symbol: '\u2717', color: 'red', label: 'Incorrect' },
};

// ─── VerdictBadge ───────────────────────────────────────────────────────────

interface VerdictBadgeProps {
  readonly verdict: ClaimVerdict;
  readonly text?: string;
}

/**
 * Compact inline badge that shows a colored verdict symbol, optionally
 * followed by claim text.
 *
 * Usage:
 *   <VerdictBadge verdict="correct" />
 *   <VerdictBadge verdict="partial" text="The derivative is 2x" />
 */
export const VerdictBadge: React.FC<VerdictBadgeProps> = ({
  verdict,
  text,
}) => {
  const style = VERDICT_STYLES[verdict];

  return (
    <Text>
      <Text color={style.color} bold>
        {style.symbol}
      </Text>
      {text != null && text.length > 0 ? (
        <Text> {text}</Text>
      ) : null}
    </Text>
  );
};
