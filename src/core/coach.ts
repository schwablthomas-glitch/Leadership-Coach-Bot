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
