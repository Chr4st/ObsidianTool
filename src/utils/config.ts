import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { StudyConfig } from '../types.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const CONFIG_DIR_NAME = '.study';
const CONFIG_FILE_NAME = 'config.json';

const DEFAULT_CONFIG: StudyConfig = {
  vault_path: '~/Documents/ResearchTree',
  anthropic_api_key: '',
  voyage_api_key: '',
  default_domain: 'general',
  mastery_threshold: 0.85,
  streak_threshold: 3,
};

// ─── Path Helpers ───────────────────────────────────────────────────────────

/**
 * Returns the directory containing the config file (~/.study/).
 */
function getConfigDir(): string {
  return path.join(os.homedir(), CONFIG_DIR_NAME);
}

/**
 * Returns the absolute path to ~/.study/config.json.
 */
export function getConfigPath(): string {
  return path.join(getConfigDir(), CONFIG_FILE_NAME);
}

/**
 * Resolves a vault path that may contain `~` to an absolute path.
 * Pure function: no filesystem side effects.
 */
export function resolveVaultPath(vaultPath: string): string {
  if (vaultPath.startsWith('~/') || vaultPath === '~') {
    return path.join(os.homedir(), vaultPath.slice(1));
  }
  return path.resolve(vaultPath);
}

// ─── File Helpers ───────────────────────────────────────────────────────────

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ─── Config Operations ──────────────────────────────────────────────────────

/**
 * Writes a StudyConfig to ~/.study/config.json.
 * Creates the ~/.study/ directory if it does not exist.
 */
export async function saveConfig(config: StudyConfig): Promise<void> {
  const configDir = getConfigDir();
  await mkdir(configDir, { recursive: true, mode: 0o700 });

  const configPath = getConfigPath();
  const json = JSON.stringify(config, null, 2);
  await writeFile(configPath, json + '\n', { encoding: 'utf-8', mode: 0o600 });
}

/**
 * Reads ~/.study/config.json and returns a StudyConfig.
 * If the file does not exist, creates it with defaults and returns those.
 */
export async function loadConfig(): Promise<StudyConfig> {
  const configPath = getConfigPath();

  if (!(await fileExists(configPath))) {
    await saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = await readFile(configPath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);

    if (parsed === null || typeof parsed !== 'object') {
      throw new Error('Config file does not contain a valid JSON object');
    }

    // Merge with defaults so new fields are always present
    return { ...DEFAULT_CONFIG, ...(parsed as Partial<StudyConfig>) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown parse error';
    throw new Error(`Failed to load config from ${configPath}: ${message}`);
  }
}

/**
 * Interactive first-run setup.
 * For now, creates a default config and returns it.
 */
export async function initConfig(): Promise<StudyConfig> {
  const config = { ...DEFAULT_CONFIG };
  await saveConfig(config);
  return config;
}
