import React from 'react';
import { Box, Text } from 'ink';
import type { ChatMessage, Claim, ClaimVerdict } from '../types.js';

interface MessageListProps {
  readonly messages: readonly ChatMessage[];
}

function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 10) {
    return 'just now';
  }
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
}

function verdictBadge(verdict: ClaimVerdict): string {
  switch (verdict) {
    case 'correct':
      return '\u2713';
    case 'incorrect':
      return '\u2717';
    case 'partial':
      return '\u25D0';
  }
}

function verdictColor(verdict: ClaimVerdict): string {
  switch (verdict) {
    case 'correct':
      return 'green';
    case 'incorrect':
      return 'red';
    case 'partial':
      return 'yellow';
  }
}

function ClaimLine({ claim }: { readonly claim: Claim }): React.JSX.Element {
  const badge = verdictBadge(claim.verdict);
  const color = verdictColor(claim.verdict);

  return (
    <Box>
      <Text color={color}>{badge} </Text>
      <Text>{claim.explanation}</Text>
      <Text dimColor> ({Math.round(claim.confidence * 100)}%)</Text>
    </Box>
  );
}

function UserMessage({
  message,
}: {
  readonly message: ChatMessage;
}): React.JSX.Element {
  return (
    <Box>
      <Text>
        <Text dimColor>{formatRelativeTime(message.timestamp)} </Text>
        <Text bold color="white">{"> "}{message.content}</Text>
      </Text>
    </Box>
  );
}

function AssistantMessage({
  message,
}: {
  readonly message: ChatMessage;
}): React.JSX.Element {
  const claims = message.claims ?? [];
  const hasClaims = claims.length > 0;

  return (
    <Box flexDirection="column">
      <Text dimColor>{formatRelativeTime(message.timestamp)}</Text>
      {hasClaims && (
        <Box flexDirection="column" marginLeft={1}>
          {claims.map((claim, i) => (
            <ClaimLine key={`claim-${i}`} claim={claim} />
          ))}
        </Box>
      )}
      {message.content.length > 0 && (
        <Box marginLeft={1}>
          <Text color="white" wrap="wrap">{message.content}</Text>
        </Box>
      )}
    </Box>
  );
}

function SystemMessage({
  message,
}: {
  readonly message: ChatMessage;
}): React.JSX.Element {
  return (
    <Box>
      <Text color="cyan">
        <Text dimColor>{formatRelativeTime(message.timestamp)} </Text>
        [system] {message.content}
      </Text>
    </Box>
  );
}

function MessageItem({
  message,
}: {
  readonly message: ChatMessage;
}): React.JSX.Element {
  switch (message.role) {
    case 'user':
      return <UserMessage message={message} />;
    case 'assistant':
      return <AssistantMessage message={message} />;
    case 'system':
      return <SystemMessage message={message} />;
  }
}

export function MessageList({ messages }: MessageListProps): React.JSX.Element {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.map((msg, i) => (
        <Box key={`msg-${i}`} marginBottom={1}>
          <MessageItem message={msg} />
        </Box>
      ))}
    </Box>
  );
}
