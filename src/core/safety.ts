// @ts-nocheck
const SAFETY_TEXT =
  'Ich kann dabei nicht helfen, bitte wende dich an professionelle Hilfe oder interne Anlaufstellen (z. B. HR, EAP, Notfallkontakt).';

const crisisPattern = /(suizid|selbstmord|ich will nicht mehr leben|kill myself|self-harm|umbringen)/i;
const violencePattern = /(gewalt|verletzen|jemandem schaden|waffe|angreifen|töten)/i;
const medicalPattern = /(medizin|diagnose|medikament|akute schmerzen|notfall|depression)/i;

export function safetyRouter(input: string): { route: 'escalation' | 'coaching'; text?: string } {
  if (crisisPattern.test(input) || violencePattern.test(input) || medicalPattern.test(input)) {
    return { route: 'escalation', text: SAFETY_TEXT };
  }
  return { route: 'coaching' };
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
