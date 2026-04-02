import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface PromptInputProps {
  readonly isProcessing: boolean;
  readonly onSubmit: (value: string) => void;
  readonly placeholder?: string;
}

const SPINNER_FRAMES = ['.', '..', '...', '..', '.'] as const;
const SPINNER_INTERVAL_MS = 300;

function ThinkingIndicator(): React.JSX.Element {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, SPINNER_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <Box>
      <Text color="yellow">Thinking{SPINNER_FRAMES[frameIndex]}</Text>
    </Box>
  );
}

export function PromptInput({
  isProcessing,
  onSubmit,
  placeholder,
}: PromptInputProps): React.JSX.Element {
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(
    (submitted: string) => {
      const trimmed = submitted.trim();
      if (trimmed.length === 0) {
        return;
      }
      setValue('');
      onSubmit(trimmed);
    },
    [onSubmit],
  );

  if (isProcessing) {
    return <ThinkingIndicator />;
  }

  return (
    <Box>
      <Text color="green" bold>{"> "}</Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder={placeholder}
      />
    </Box>
  );
}
