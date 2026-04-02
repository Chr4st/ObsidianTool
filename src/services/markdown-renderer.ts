// ─── Markdown to Terminal-Formatted Text Service ────────────────────────────
//
// Converts Markdown (possibly containing LaTeX) into terminal-formatted text
// using `marked` + `marked-terminal`, with code-block syntax highlighting
// via `cli-highlight` and LaTeX rendering via the local latex-renderer.
//
// All functions are pure: no side effects, no mutation.
// ─────────────────────────────────────────────────────────────────────────────

import chalk from 'chalk';
import { highlight } from 'cli-highlight';
import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

import {
  renderDisplayLatex,
  renderInlineLatex,
} from './latex-renderer.js';

// ─── Marked Configuration ───────────────────────────────────────────────────

/**
 * Syntax-highlight a code block for the terminal.
 * Falls back to unhighlighted text when the language is unknown.
 */
const highlightCode = (code: string, language: string): string => {
  try {
    return highlight(code, { language, ignoreIllegals: true });
  } catch {
    return code;
  }
};

/** Build a fresh Marked instance configured for terminal output. */
const createConfiguredMarked = (): Marked => {
  const instance = new Marked();

  instance.use(
    markedTerminal({
      // Heading styles
      firstHeading: chalk.magenta.bold.underline,
      heading: chalk.green.bold,

      // Inline styles
      strong: chalk.bold,
      em: chalk.italic,
      codespan: chalk.yellow,
      del: chalk.dim.gray.strikethrough,

      // Links
      link: chalk.blue,
      href: chalk.blue.underline,

      // Code blocks — delegate to cli-highlight
      code: highlightCode,

      // Lists
      listitem: chalk.reset,

      // Block-level
      blockquote: chalk.gray.italic,
      paragraph: chalk.reset,
      hr: chalk.reset,

      // Misc
      unescape: true,
      width: 80,
    }),
  );

  return instance;
};

const configuredMarked = createConfiguredMarked();

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Render a Markdown string to terminal-formatted text.
 * Does NOT process LaTeX — use `renderMarkdownWithLatex` for that.
 */
export const renderMarkdown = (markdown: string): string => {
  try {
    const result = configuredMarked.parse(markdown);
    // marked.parse returns `string | Promise<string>` but our config is sync
    return typeof result === 'string' ? result : markdown;
  } catch {
    return markdown;
  }
};

/**
 * Render a Markdown string that may contain LaTeX to terminal-formatted text.
 *
 * Processing order:
 *  1. Display LaTeX (`$$...$$`) — converted to indented Unicode blocks
 *  2. Inline LaTeX (`$...$`)    — converted to inline Unicode
 *  3. Markdown                  — rendered via marked-terminal
 */
export const renderMarkdownWithLatex = (markdown: string): string => {
  try {
    const afterDisplay = renderDisplayLatex(markdown);
    const afterInline = renderInlineLatex(afterDisplay);
    return renderMarkdown(afterInline);
  } catch {
    return markdown;
  }
};
