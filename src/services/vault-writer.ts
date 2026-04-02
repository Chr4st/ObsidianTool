import {
  readFile,
  writeFile,
  mkdir,
  access,
  readdir,
  unlink,
  stat,
} from 'node:fs/promises';
import path from 'node:path';

// ─── Path Validation ────────────────────────────────────────────────────────

/**
 * Ensures a relative path does not escape the vault root via `..` segments
 * or absolute path tricks.  Throws on violation.
 */
function assertSafePath(vaultRoot: string, relativePath: string): string {
  // Reject absolute paths outright
  if (path.isAbsolute(relativePath)) {
    throw new Error(
      `Path must be relative to the vault root.  Got absolute path: ${relativePath}`,
    );
  }

  const resolved = path.resolve(vaultRoot, relativePath);

  // After resolution the path must still live under the vault root
  if (!resolved.startsWith(vaultRoot + path.sep) && resolved !== vaultRoot) {
    throw new Error(
      `Path escapes the vault root.  Resolved "${resolved}" is outside "${vaultRoot}"`,
    );
  }

  return resolved;
}

// ─── VaultWriter ────────────────────────────────────────────────────────────

export class VaultWriter {
  private readonly vaultRoot: string;

  constructor(vaultPath: string) {
    // Normalise once so every later comparison is consistent
    this.vaultRoot = path.resolve(vaultPath);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Returns the vault root (absolute path). */
  getVaultPath(): string {
    return this.vaultRoot;
  }

  /** Resolves a relative note path to an absolute path (with safety check). */
  resolveNotePath(relativePath: string): string {
    return assertSafePath(this.vaultRoot, relativePath);
  }

  /**
   * Writes content to a note file inside the vault.
   * Creates parent directories as needed.
   * Returns the absolute path that was written.
   */
  async writeNote(relativePath: string, content: string): Promise<string> {
    const absolute = assertSafePath(this.vaultRoot, relativePath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content, 'utf-8');
    return absolute;
  }

  /**
   * Reads a note from the vault.
   * Returns file content or `null` when the file does not exist.
   */
  async readNote(relativePath: string): Promise<string | null> {
    const absolute = assertSafePath(this.vaultRoot, relativePath);
    try {
      return await readFile(absolute, 'utf-8');
    } catch {
      return null;
    }
  }

  /** Returns `true` when the note exists on disk. */
  async noteExists(relativePath: string): Promise<boolean> {
    const absolute = assertSafePath(this.vaultRoot, relativePath);
    try {
      await access(absolute);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lists note files (*.md) under an optional directory prefix.
   * Returns an array of paths relative to the vault root.
   */
  async listNotes(directoryPrefix?: string): Promise<readonly string[]> {
    const baseDir = directoryPrefix
      ? assertSafePath(this.vaultRoot, directoryPrefix)
      : this.vaultRoot;

    try {
      return await this.collectMarkdownFiles(baseDir, this.vaultRoot);
    } catch {
      // Directory does not exist yet -- that is fine
      return [];
    }
  }

  /** Deletes a note from the vault. No-op if the file does not exist. */
  async deleteNote(relativePath: string): Promise<void> {
    const absolute = assertSafePath(this.vaultRoot, relativePath);
    try {
      await unlink(absolute);
    } catch {
      // Already gone -- nothing to do
    }
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Recursively collects *.md files under `dir`, returning paths relative
   * to `root`.
   */
  private async collectMarkdownFiles(
    dir: string,
    root: string,
  ): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });

    const results: string[][] = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          return this.collectMarkdownFiles(fullPath, root);
        }

        if (entry.isFile() && entry.name.endsWith('.md')) {
          return [path.relative(root, fullPath)];
        }

        return [];
      }),
    );

    return results.flat();
  }
}
