import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';

const VERSION = '0.1.0';

const program = new Command();

program
  .name('study')
  .version(VERSION)
  .description('CLI-native AI study tool with Socratic tutoring')
  .option('--vault <path>', 'override vault path')
  .option('--domain <name>', 'set study domain');

program
  .command('chat', { isDefault: true })
  .description('launch interactive Socratic chat REPL')
  .action(() => {
    const opts = program.opts<{ vault?: string; domain?: string }>();
    launchChatRepl(opts.vault, opts.domain);
  });

program
  .command('review')
  .description('launch spaced-repetition review mode')
  .action(() => {
    console.log('Review mode coming soon');
  });

program
  .command('analyze [path]')
  .description('analyze a codebase for architecture patterns')
  .action((_path?: string) => {
    console.log('Analyze mode coming soon');
  });

program
  .command('note <topic>')
  .description('create a new concept note')
  .action((_topic: string) => {
    console.log('Editor mode coming soon');
  });

program
  .command('edit <path>')
  .description('edit an existing note')
  .action((_path: string) => {
    console.log('Editor mode coming soon');
  });

program
  .command('search <query>')
  .description('semantic search across vault and conversations')
  .action((_query: string) => {
    console.log('Search mode coming soon');
  });

program
  .command('status')
  .description('show mastery overview across all domains')
  .action(() => {
    console.log('Status mode coming soon');
  });

function launchChatRepl(vaultPath?: string, domain?: string): void {
  const inkInstance = render(
    React.createElement(App, { vaultPath, domain }),
  );

  const shutdown = (): void => {
    inkInstance.unmount();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

program.parse();
