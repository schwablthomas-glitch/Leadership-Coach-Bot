import 'dotenv/config';
import Fastify from 'fastify';
import { registerTeamsAdapter } from './adapters/teams.js';
import { processMessage } from './core/pipeline.js';

const app = Fastify({ logger: true });

const port = Number(process.env.PORT ?? 3000);
const orgSalt = process.env.ORG_SALT ?? '';
const teamsAppId = process.env.TEAMS_APP_ID ?? '';
const teamsAppPassword = process.env.TEAMS_APP_PASSWORD ?? '';
const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? '';

app.get('/health', async () => ({ ok: true }));

app.get('/webchat', async () => ({
  message: 'Webchat endpoint läuft. Nutze POST /api/chat für lokale Tests.',
  teamsMessagingEndpoint: publicBaseUrl ? `${publicBaseUrl}/api/teams/messages` : 'Set PUBLIC_BASE_URL'
}));

app.post<{ Body: { message: string; stableUserId?: string; orgId?: string } }>('/api/chat', async (request) => {
  const response = await processMessage({
    message: request.body.message,
    stableUserId: request.body.stableUserId ?? 'local-user',
    orgId: request.body.orgId ?? 'webchat:local',
    orgSalt
  });

  return { reply: response };
});

registerTeamsAdapter(app, {
  appId: teamsAppId,
  appPassword: teamsAppPassword,
  orgSalt
});

const bootstrap = async (): Promise<void> => {
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Server listening on ${port}`);
  app.log.info(`Teams messages endpoint: /api/teams/messages`);
};

bootstrap().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
