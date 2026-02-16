import type { FastifyInstance } from 'fastify';
import { BotFrameworkAdapter, TurnContext } from 'botbuilder';
import { processMessage } from '../core/pipeline.js';

export interface TeamsAdapterConfig {
  appId: string;
  appPassword: string;
  orgSalt: string;
}

export function registerTeamsAdapter(app: FastifyInstance, config: TeamsAdapterConfig): void {
  const adapter = new BotFrameworkAdapter({
    appId: config.appId,
    appPassword: config.appPassword
  });

  adapter.onTurnError = async (turnContext: TurnContext, error: Error) => {
    app.log.error({ error }, 'Teams adapter turn error');
    await turnContext.sendActivity('Entschuldigung, es gab einen technischen Fehler.');
  };

  app.post('/api/teams/messages', async (request, reply) => {
    await adapter.processActivity(request.raw, reply.raw, async (turnContext) => {
      if (turnContext.activity.type !== 'message') {
        return;
      }

      const stableUserId =
        turnContext.activity.from?.aadObjectId ??
        turnContext.activity.from?.id ??
        'unknown-user';
      const tenantId = turnContext.activity.conversation?.tenantId ?? 'unknown-tenant';
      const orgId = `teams:${tenantId}`;
      const text = turnContext.activity.text ?? '';

      const response = await processMessage({
        message: text,
        stableUserId,
        orgId,
        orgSalt: config.orgSalt
      });

      await turnContext.sendActivity(response);
    });
  });
}
