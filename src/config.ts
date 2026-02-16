// @ts-nocheck
import { existsSync, readFileSync } from 'node:fs';

export interface AppConfig {
  openAIApiKey?: string;
  openAIModel: string;
  orgSalt: string;
  retentionDays: number;
  port: number;
  dbPath: string;
  openAITimeoutMs: number;
}

function parseDotEnvFile(path = '.env'): Record<string, string> {
  if (!existsSync(path)) return {};
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const env: Record<string, string> = {};
  for (const line of lines) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const fileEnv = parseDotEnvFile();
  const merged = { ...fileEnv, ...env };

  const orgSalt = merged.ORG_SALT;
  if (!orgSalt) {
    throw new Error('ORG_SALT ist erforderlich.');
  }

  return {
    openAIApiKey: merged.OPENAI_API_KEY,
    openAIModel: merged.OPENAI_MODEL ?? 'gpt-4.1-mini',
    orgSalt,
    retentionDays: toInt(merged.RETENTION_DAYS, 30),
    port: toInt(merged.PORT, 3000),
    dbPath: merged.DB_PATH ?? './data/coach.sqlite',
    openAITimeoutMs: toInt(merged.OPENAI_TIMEOUT_MS, 10000),
  };
}
