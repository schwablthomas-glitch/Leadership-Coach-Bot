// @ts-nocheck
import { COACH_SYSTEM_PROMPT, NORMALIZER_SYSTEM_PROMPT } from './prompts.js';
import type { Message } from './types.js';

export interface NormalizedInput {
  thema: string;
  ziel: string;
  kontext: string;
  constraints: string;
}

interface OpenAIConfig {
  apiKey?: string;
  model: string;
  timeoutMs: number;
}

async function callOpenAI(messages: Array<{ role: 'system' | 'user'; content: string }>, config: OpenAIConfig): Promise<string> {
  if (!config.apiKey) {
    return 'Fallback: kein OPENAI_API_KEY gesetzt.';
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({ model: config.model, messages, temperature: 0.3 }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        throw new Error(`OpenAI Fehler: ${response.status}`);
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content?.trim() ?? 'Keine Antwort erhalten.';
    } catch (error) {
      lastError = error;
      if (attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
  throw new Error(`OpenAI Anfrage fehlgeschlagen: ${String(lastError)}`);
}

function redactPII(text: string): string {
  return text
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[redacted-email]')
    .replace(/\+?\d[\d\s/-]{7,}\d/g, '[redacted-phone]')
    .replace(/\b([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+)\b/g, '[redacted-name]');
}

export async function normalize(input: string, config: OpenAIConfig): Promise<NormalizedInput> {
  const redacted = redactPII(input);
  const raw = await callOpenAI(
    [
      { role: 'system', content: NORMALIZER_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Gib NUR JSON zurück mit thema, ziel, kontext, constraints. Eingabe: ${redacted}`,
      },
    ],
    config,
  );

  try {
    const parsed = JSON.parse(raw) as Partial<NormalizedInput>;
    return {
      thema: parsed.thema ?? 'Unklar',
      ziel: parsed.ziel ?? 'Klärung des nächsten Schritts',
      kontext: parsed.kontext ?? 'Kein zusätzlicher Kontext',
      constraints: parsed.constraints ?? 'Keine genannt',
    };
  } catch {
    return {
      thema: 'Unklar',
      ziel: 'Klärung des nächsten Schritts',
      kontext: redacted,
      constraints: 'Keine genannt',
    };
  }
}

export async function coachRespond(
  normalized: NormalizedInput,
  history: Message[],
  config: OpenAIConfig,
): Promise<string> {
  const historyText = history.map((m) => `${m.role}: ${m.text}`).join('\n');
  const userPrompt = `Thema: ${normalized.thema}\nZiel: ${normalized.ziel}\nKontext: ${normalized.kontext}\nConstraints: ${normalized.constraints}\n\nVerlauf:\n${historyText}`;

  const reply = await callOpenAI(
    [
      { role: 'system', content: COACH_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    config,
  );

  if (reply.startsWith('Fallback:')) {
    return [
      '1) Ziel klären: Was soll in den nächsten 7 Tagen konkret besser sein?',
      '2) Zwei Fragen: Was liegt in deinem Einflussbereich? Was wäre ein kleiner, mutiger Schritt?',
      '3) Intervention: Schreibe 5 Minuten lang ungefiltert auf, was dich wirklich blockiert.',
      '4) Mini-Plan:\n- Heute 1 Priorität festlegen\n- Morgen 15 Minuten Fokusblock\n- Ende der Woche Fortschritt reflektieren',
    ].join('\n\n');
  }

  return reply;
export interface CoachContext {
  userId: string;
  orgId: string;
}

export async function coachReply(input: string, context: CoachContext): Promise<string> {
  return [
    'Danke für deine Nachricht.',
    `Ich habe sie für ${context.orgId} als Nutzer ${context.userId.slice(0, 8)}… verarbeitet.`,
    `Mein Coaching-Impuls: Was wäre ein kleiner, konkreter nächster Schritt zu „${input}“?`
  ].join(' ');
}
