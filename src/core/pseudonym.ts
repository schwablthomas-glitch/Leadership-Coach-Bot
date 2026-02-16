import { createHmac } from 'node:crypto';

export function pseudonymizeUserId(stableUserId: string, salt: string): string {
  if (!stableUserId) {
    throw new Error('stableUserId is required');
  }
  if (!salt) {
    throw new Error('ORG_SALT is required to pseudonymize user IDs');
  }

  return createHmac('sha256', salt).update(stableUserId).digest('hex');
}
