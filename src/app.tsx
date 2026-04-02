import React, { useState, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import { ChatMode } from './modes/chat-mode.js';

const VERSION = '0.1.0';

type AppMode = 'chat' | 'editor' | 'review' | 'analyze' | 'status';

interface AppProps {
  readonly vaultPath?: string;
  readonly domain?: string;
}

function PlaceholderMode({ mode }: { readonly mode: string }): React.JSX.Element {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color="yellow">{mode} mode is not yet implemented.</Text>
      <Text dimColor>Press Ctrl+C to exit.</Text>
    </Box>
  );
}

function Header({ vaultPath }: { readonly vaultPath: string }): React.JSX.Element {
  return (
    <Box borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false} paddingX={1}>
      <Text bold color="cyan">ObsidianTool v{VERSION}</Text>
      <Text>  |  </Text>
      <Text dimColor>Vault: {vaultPath}</Text>
    </Box>
  );
}

function Footer(): React.JSX.Element {
  return (
    <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
      <Text dimColor>
        /help  /review  /search  /status  /topic  /clear  :q quit
      </Text>
    </Box>
  );
}

export function App({ vaultPath, domain }: AppProps): React.JSX.Element {
  const resolvedVault = vaultPath ?? '~/vault';
  const resolvedDomain = domain ?? 'general';
  const [mode, setMode] = useState<AppMode>('chat');
  const { exit } = useApp();

  const handleModeChange = useCallback((newMode: AppMode) => {
    setMode(newMode);
  }, []);

  const handleQuit = useCallback(() => {
    exit();
  }, [exit]);

  const renderMode = (): React.JSX.Element => {
    switch (mode) {
      case 'chat':
        return (
          <ChatMode
            vaultPath={resolvedVault}
            domain={resolvedDomain}
            onModeChange={handleModeChange}
            onQuit={handleQuit}
          />
        );
      case 'editor':
        return <PlaceholderMode mode="Editor" />;
      case 'review':
        return <PlaceholderMode mode="Review" />;
      case 'analyze':
        return <PlaceholderMode mode="Analyze" />;
      case 'status':
        return <PlaceholderMode mode="Status" />;
    }
  };

  return (
    <Box flexDirection="column" width="100%">
      <Header vaultPath={resolvedVault} />
      {renderMode()}
      <Footer />
    </Box>
  );
}
