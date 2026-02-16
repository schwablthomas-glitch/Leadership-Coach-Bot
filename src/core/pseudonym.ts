// @ts-nocheck
import { createHash } from 'node:crypto';

export function pseudonymize(phoneOrUserId: string, orgSalt: string): string {
  if (!phoneOrUserId || !orgSalt) {
    throw new Error('phoneOrUserId und orgSalt sind erforderlich.');
  }
  return createHash('sha256').update(`${phoneOrUserId}${orgSalt}`).digest('hex');
}
