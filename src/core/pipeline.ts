import { coachReply } from './coach.js';
import { logIncident } from './incidents.js';
import { normalizeInput } from './normalize.js';
import { pseudonymizeUserId } from './pseudonym.js';
import { applySafety } from './safety.js';

export interface ProcessMessageInput {
  message: string;
  stableUserId: string;
  orgId: string;
  orgSalt: string;
}

export async function processMessage(input: ProcessMessageInput): Promise<string> {
  const userId = pseudonymizeUserId(input.stableUserId, input.orgSalt);
  const safety = applySafety(input.message);

  for (const incident of safety.incidents) {
    await logIncident({
      timestamp: new Date().toISOString(),
      org_id: input.orgId,
      user_id: userId,
      reason: incident.reason,
      fingerprint: incident.fingerprint
    });
  }

  const normalized = normalizeInput(safety.safeText);
  return coachReply(normalized, { userId, orgId: input.orgId });
}
