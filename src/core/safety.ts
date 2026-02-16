import { createHash } from 'node:crypto';

export interface SafetyIncident {
  reason: string;
  fingerprint: string;
}

export interface SafetyResult {
  safeText: string;
  incidents: SafetyIncident[];
}

const BLOCK_PATTERNS: Array<{ reason: string; regex: RegExp }> = [
  { reason: 'possible_self_harm', regex: /\b(kill myself|suicide|self-harm)\b/i },
  { reason: 'possible_pii_email', regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi }
];

export function applySafety(text: string): SafetyResult {
  const incidents: SafetyIncident[] = [];
  let safeText = text;

  for (const { reason, regex } of BLOCK_PATTERNS) {
    if (regex.test(safeText)) {
      incidents.push({
        reason,
        fingerprint: createHash('sha256').update(text).digest('hex')
      });
      safeText = safeText.replace(regex, '[REDACTED]');
    }
  }

  return { safeText, incidents };
}
