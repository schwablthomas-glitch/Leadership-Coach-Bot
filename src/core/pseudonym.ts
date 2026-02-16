// @ts-nocheck
import { createHash } from 'node:crypto';

export function pseudonymize(phoneOrUserId: string, orgSalt: string): string {
  if (!phoneOrUserId || !orgSalt) {
    throw new Error('phoneOrUserId und orgSalt sind erforderlich.');
  }
  return createHash('sha256').update(`${phoneOrUserId}${orgSalt}`).digest('hex');
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
