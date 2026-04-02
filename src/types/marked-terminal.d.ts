declare module 'marked-terminal' {
  import type { MarkedExtension } from 'marked';

  interface MarkedTerminalOptions {
    readonly code?: ((code: string, language: string) => string) | unknown;
    readonly blockquote?: unknown;
    readonly html?: unknown;
    readonly heading?: unknown;
    readonly firstHeading?: unknown;
    readonly hr?: unknown;
    readonly listitem?: unknown;
    readonly list?: unknown;
    readonly table?: unknown;
    readonly paragraph?: unknown;
    readonly strong?: unknown;
    readonly em?: unknown;
    readonly codespan?: unknown;
    readonly del?: unknown;
    readonly link?: unknown;
    readonly href?: unknown;
    readonly text?: unknown;
    readonly unescape?: boolean;
    readonly emoji?: boolean;
    readonly width?: number;
    readonly showSectionPrefix?: boolean;
    readonly reflowText?: boolean;
    readonly tab?: number;
  }

  export function markedTerminal(
    options?: MarkedTerminalOptions,
  ): MarkedExtension;

  export default markedTerminal;
}
