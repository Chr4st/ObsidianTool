import React, { useState, useCallback } from 'react';
import { Box, Text, Newline } from 'ink';
import type { ChatMessage, VerificationResult } from '../types.js';
import { MessageList } from '../components/message-list.js';
import { PromptInput } from '../components/prompt-input.js';

type AppMode = 'chat' | 'editor' | 'review' | 'analyze' | 'status';

interface ChatModeProps {
  readonly vaultPath: string;
  readonly domain: string;
  readonly onModeChange: (mode: AppMode) => void;
  readonly onQuit: () => void;
}

function createMessage(
  role: ChatMessage['role'],
  content: string,
  claims?: ChatMessage['claims'],
): ChatMessage {
  return {
    role,
    content,
    claims,
    timestamp: new Date().toISOString(),
  };
}

function mockAiResponse(userInput: string): Promise<VerificationResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        claims: [
          {
            text: userInput,
            verdict: 'correct',
            explanation: 'Looks good!',
            confidence: 0.9,
          },
        ],
        followUpQuestion: 'Can you elaborate on that?',
        masteryUpdate: null,
        generatedNote: null,
      });
    }, 1000);
  });
}

const HELP_TEXT = [
  'Available commands:',
  '  /help           - show this help text',
  '  /review         - switch to review mode',
  '  /search <query> - semantic search',
  '  /status         - show mastery stats',
  '  /topic <name>   - set current study topic',
  '  /clear          - clear message history',
  '  :q or /quit     - quit the application',
  '  :e [filename]   - switch to editor mode',
].join('\n');

export function ChatMode({
  vaultPath: _vaultPath,
  domain,
  onModeChange,
  onQuit,
}: ChatModeProps): React.JSX.Element {
  const [messages, setMessages] = useState<readonly ChatMessage[]>([
    createMessage('system', `Welcome! Studying domain: ${domain}. Type /help for commands.`),
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [masteryScore, setMasteryScore] = useState(0);
  const [streak, setStreak] = useState(0);

  const addMessage = useCallback(
    (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    },
    [],
  );

  const handleSlashCommand = useCallback(
    (input: string): boolean => {
      const trimmed = input.trim();

      if (trimmed === '/help') {
        addMessage(createMessage('system', HELP_TEXT));
        return true;
      }

      if (trimmed === '/review') {
        onModeChange('review');
        return true;
      }

      if (trimmed.startsWith('/search ')) {
        addMessage(createMessage('system', 'Search mode coming soon.'));
        return true;
      }

      if (trimmed === '/status') {
        const statusText = [
          `Topic: ${currentTopic ?? 'none'}`,
          `Mastery: ${masteryScore}%`,
          `Streak: ${streak}`,
        ].join('\n');
        addMessage(createMessage('system', statusText));
        return true;
      }

      if (trimmed.startsWith('/topic ')) {
        const topicName = trimmed.slice(7).trim();
        if (topicName.length > 0) {
          setCurrentTopic(topicName);
          addMessage(createMessage('system', `Topic set to: ${topicName}`));
        }
        return true;
      }

      if (trimmed === '/clear') {
        setMessages([
          createMessage('system', 'Chat cleared. Type /help for commands.'),
        ]);
        return true;
      }

      if (trimmed === ':q' || trimmed === '/quit') {
        onQuit();
        return true;
      }

      if (trimmed === ':e' || trimmed.startsWith(':e ')) {
        onModeChange('editor');
        return true;
      }

      return false;
    },
    [addMessage, onModeChange, onQuit, currentTopic, masteryScore, streak],
  );

  const handleSubmit = useCallback(
    async (input: string) => {
      if (handleSlashCommand(input)) {
        return;
      }

      const userMsg = createMessage('user', input);
      addMessage(userMsg);
      setIsProcessing(true);

      try {
        const result = await mockAiResponse(input);
        const responseParts: string[] = [];

        for (const claim of result.claims) {
          const badge =
            claim.verdict === 'correct'
              ? '\u2713'
              : claim.verdict === 'incorrect'
                ? '\u2717'
                : '\u25D0';
          responseParts.push(`${badge} ${claim.explanation}`);
        }

        if (result.followUpQuestion) {
          responseParts.push('');
          responseParts.push(result.followUpQuestion);
        }

        const assistantMsg = createMessage(
          'assistant',
          responseParts.join('\n'),
          result.claims,
        );
        addMessage(assistantMsg);

        setStreak((prev) => prev + 1);
        setMasteryScore((prev) => Math.min(100, prev + 5));
      } catch {
        addMessage(createMessage('system', 'Error: failed to get AI response.'));
      } finally {
        setIsProcessing(false);
      }
    },
    [handleSlashCommand, addMessage],
  );

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {currentTopic && (
        <Box>
          <Text dimColor>
            Topic: <Text color="yellow">{currentTopic}</Text>
            {'  '}Mastery: <Text color="green">{masteryScore}%</Text>
            {'  '}Streak: <Text color="magenta">{streak}</Text>
          </Text>
        </Box>
      )}
      <Newline />
      <MessageList messages={messages} />
      <Newline />
      <PromptInput
        isProcessing={isProcessing}
        onSubmit={handleSubmit}
        placeholder="Explain a concept or answer a question..."
      />
    </Box>
  );
}
