import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Text, Newline } from 'ink';
import type { ChatMessage } from '../types.js';
import { MessageList } from '../components/message-list.js';
import { PromptInput } from '../components/prompt-input.js';
import { ClaudeClient } from '../services/claude-client.js';
import { SocraticEngine } from '../services/socratic-engine.js';
import { NoteGenerator } from '../services/note-generator.js';
import { VaultWriter } from '../services/vault-writer.js';
import { loadConfig, resolveVaultPath } from '../utils/config.js';

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
  vaultPath,
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
  const [initError, setInitError] = useState<string | null>(null);

  // Services refs — initialized once
  const engineRef = useRef<SocraticEngine | null>(null);
  const noteGenRef = useRef<NoteGenerator | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const config = await loadConfig();
        const apiKey = config.anthropic_api_key || process.env.ANTHROPIC_API_KEY || '';
        if (!apiKey) {
          setInitError('No API key found. Set ANTHROPIC_API_KEY env var or add to ~/.study/config.json');
          return;
        }
        const client = new ClaudeClient(apiKey);
        engineRef.current = new SocraticEngine(
          client,
          config.mastery_threshold,
          config.streak_threshold,
        );
        const resolvedVault = resolveVaultPath(vaultPath || config.vault_path);
        const writer = new VaultWriter(resolvedVault);
        noteGenRef.current = new NoteGenerator(writer);
      } catch (err) {
        setInitError(`Init failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
  }, [vaultPath]);

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
        const engine = engineRef.current;
        if (!engine) {
          addMessage(createMessage('system', initError ?? 'Services not initialized. Check API key.'));
          return;
        }

        // Start conversation if needed
        if (!currentTopic) {
          engine.startConversation(input.slice(0, 50), domain);
          setCurrentTopic(input.slice(0, 50));
        }

        const turn = await engine.processMessage(input);
        const responseParts: string[] = [];

        for (const claim of turn.claims) {
          const badge =
            claim.verdict === 'correct'
              ? '\u2713'
              : claim.verdict === 'incorrect'
                ? '\u2717'
                : '\u25D0';
          responseParts.push(`${badge} ${claim.explanation}`);
        }

        if (turn.followUp) {
          responseParts.push('');
          responseParts.push(`\u2192 ${turn.followUp}`);
        }

        const assistantMsg = createMessage(
          'assistant',
          responseParts.join('\n'),
          turn.claims,
        );
        addMessage(assistantMsg);

        setStreak(turn.streak);
        setMasteryScore(Math.round(turn.currentScore * 100));

        // Handle mastery reached
        if (turn.masteryReached && noteGenRef.current) {
          const summary = engine.getConversationSummary();
          const correctClaims = summary.allClaims.filter((c: { verdict: string }) => c.verdict === 'correct');
          const claimContent = correctClaims.map(c => `- ${c.text}`).join('\n');
          const notePath = await noteGenRef.current.generateConceptNote(
            currentTopic ?? input.slice(0, 50),
            domain,
            correctClaims,
            `# ${currentTopic ?? input.slice(0, 50)}\n\n${claimContent}`,
            [],
          );
          addMessage(createMessage('system', `\uD83C\uDFAF Mastery reached! Note saved: ${notePath}`));
          engine.reset();
          setCurrentTopic(null);
          setStreak(0);
          setMasteryScore(0);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        addMessage(createMessage('system', `Error: ${msg}`));
      } finally {
        setIsProcessing(false);
      }
    },
    [handleSlashCommand, addMessage, currentTopic, domain, initError],
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
