/**
 * @q-cms/cli — local config helpers.
 *
 * Persists CLI authentication and project state in `~/.q-cms/config.json`
 * (or the override in `QCMS_CONFIG_DIR`). Provides project discovery
 * by walking up the directory tree looking for `schema.ts`.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { Ok, Err, type Result } from '@q-cms/core/result';
import { NotFoundError, ValidationError } from '@q-cms/core/errors';

const CONFIG_DIR = process.env['QCMS_CONFIG_DIR'] ?? join(homedir(), '.q-cms');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const PROJECT_MARKERS = ['schema.ts', 'q-cms.config.ts', 'q-cms.config.json', '.q-cms'] as const;

export interface QcmsUserConfig {
  readonly baseUrl: string;
  readonly token: string;
  readonly tokenType: 'jwt' | 'api_token';
  readonly email?: string;
  readonly userId?: string;
  readonly createdAt: string;
}

export interface QcmsConfigFile {
  readonly version: 1;
  readonly currentProfile?: string;
  readonly profiles: Record<string, QcmsUserConfig>;
}

const DEFAULT_CONFIG: QcmsConfigFile = {
  version: 1,
  profiles: {},
};

/** Ensure config dir exists. */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

/** Read the config file from disk, returning defaults if missing. */
export function readConfig(): QcmsConfigFile {
  if (!existsSync(CONFIG_FILE)) return DEFAULT_CONFIG;
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<QcmsConfigFile>;
    if (parsed.version !== 1) {
      throw new Error(`Unsupported config version: ${parsed.version}`);
    }
    return {
      version: 1,
      ...(parsed.currentProfile ? { currentProfile: parsed.currentProfile } : {}),
      profiles: parsed.profiles ?? {},
    };
  } catch (err) {
    throw new Error(`Failed to read config at ${CONFIG_FILE}: ${(err as Error).message}`);
  }
}

/** Persist config to disk. */
export function writeConfig(config: QcmsConfigFile): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/** Save a profile (overwrite or create). */
export function saveProfile(name: string, profile: Omit<QcmsUserConfig, 'createdAt'>): void {
  const config = readConfig();
  writeConfig({
    version: config.version,
    currentProfile: name,
    profiles: {
      ...config.profiles,
      [name]: { ...profile, createdAt: new Date().toISOString() },
    },
  });
}

/** Delete a profile. Returns Ok if removed, Err if not found. */
export function deleteProfile(name: string): Result<void, NotFoundError> {
  const config = readConfig();
  if (!config.profiles[name]) {
    return Err(new NotFoundError(`Profile '${name}' not found`));
  }

  const profiles = { ...config.profiles };
  delete profiles[name];

  const currentProfile = config.currentProfile === name ? Object.keys(profiles)[0] : config.currentProfile;
  writeConfig({
    version: config.version,
    ...(currentProfile ? { currentProfile } : {}),
    profiles,
  });
  return Ok(undefined);
}

/** Get the active profile (current). */
export function getCurrentProfile(): QcmsUserConfig | undefined {
  const config = readConfig();
  if (!config.currentProfile) return undefined;
  return config.profiles[config.currentProfile];
}

/** Walk up from cwd looking for a project root marker. */
export function findProjectRoot(start: string = process.cwd()): string | undefined {
  let current = resolve(start);
  const visited = new Set<string>();
  while (!visited.has(current)) {
    visited.add(current);
    for (const marker of PROJECT_MARKERS) {
      if (existsSync(join(current, marker))) return current;
    }
    const parent = dirname(current);
    if (parent === current) return undefined; // reached filesystem root
    current = parent;
  }
  return undefined;
}

/** Resolve the project root or throw a friendly error. */
export function requireProjectRoot(): string {
  const root = findProjectRoot();
  if (!root) {
    throw new ValidationError(
      'No Q-CMS project found. Run `q-cms init <name>` to create one, or cd into a project.',
      { meta: { cwd: process.cwd() } },
    );
  }
  return root;
}

/** Validate that a profile name is safe (no path traversal, no special chars). */
export function isValidProfileName(name: string): boolean {
  return /^[a-z0-9_-]{1,64}$/i.test(name);
}

/** Format config path for diagnostic output. */
export function configPath(): string {
  return CONFIG_FILE;
}
