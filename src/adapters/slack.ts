import crypto from "node:crypto";
import { App, type LogLevel } from "@slack/bolt";

export type SlackMode = "http" | "socket";

export interface CoachCore {
  handleMessage(input: {
    org_id: string;
    user_id: string;
    text: string;
    source: "slack";
    metadata: Record<string, string>;
  }): Promise<string>;
}

export interface SlackAdapterEnv {
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  SLACK_APP_TOKEN?: string;
  SLACK_MODE?: SlackMode;
}

export interface SlackEventEnvelope {
  type: string;
  challenge?: string;
  team_id?: string;
  event?: {
    type: string;
    text?: string;
    user?: string;
    channel?: string;
    channel_type?: string;
    ts?: string;
    thread_ts?: string;
    subtype?: string;
    bot_id?: string;
  };
  authorizations?: Array<{ team_id?: string }>;
}

export interface ParsedSlackMessage {
  teamId: string;
  userId: string;
  text: string;
  channelId: string;
  threadTs?: string;
  eventTs?: string;
}

export function getSlackMode(env: SlackAdapterEnv): SlackMode {
  return env.SLACK_MODE === "socket" ? "socket" : "http";
}

export function mapOrgId(teamId: string): string {
  return `slack:${teamId}`;
}

export function pseudoUserId(teamId: string, userId: string, salt = ""): string {
  const digest = crypto
    .createHash("sha256")
    .update(`slack:${teamId}:${userId}:${salt}`)
    .digest("hex");
  return `u_${digest.slice(0, 24)}`;
}

export function verifySlackSignature(input: {
  signingSecret: string;
  timestamp: string;
  rawBody: string;
  slackSignature: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): boolean {
  const {
    signingSecret,
    timestamp,
    rawBody,
    slackSignature,
    nowSeconds = Math.floor(Date.now() / 1000),
    toleranceSeconds = 60 * 5,
  } = input;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return false;
  }
  if (Math.abs(nowSeconds - ts) > toleranceSeconds) {
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody}`;
  const computed = `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex")}`;

  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(slackSignature));
}

function stripMentionToken(text: string): string {
  return text.replace(/^\s*<@[^>]+>\s*/u, "").trim();
}

export function parseSlackMessageEvent(
  envelope: SlackEventEnvelope,
): ParsedSlackMessage | null {
  const event = envelope.event;
  if (!event || event.subtype || event.bot_id || !event.user || !event.channel) {
    return null;
  }

  const teamId = envelope.team_id ?? envelope.authorizations?.[0]?.team_id;
  if (!teamId) {
    return null;
  }

  const isAppMention = event.type === "app_mention";
  const isDirectMessage = event.type === "message" && event.channel_type === "im";

  if (!isAppMention && !isDirectMessage) {
    return null;
  }

  const rawText = event.text ?? "";
  const text = isAppMention ? stripMentionToken(rawText) : rawText.trim();
  if (!text) {
    return null;
  }

  return {
    teamId,
    userId: event.user,
    text,
    channelId: event.channel,
    threadTs: event.thread_ts,
    eventTs: event.ts,
  };
}

export async function routeSlackMessageToCore(core: CoachCore, msg: ParsedSlackMessage) {
  return core.handleMessage({
    org_id: mapOrgId(msg.teamId),
    user_id: pseudoUserId(msg.teamId, msg.userId),
    text: msg.text,
    source: "slack",
    metadata: {
      team_id: msg.teamId,
      channel_id: msg.channelId,
      thread_ts: msg.threadTs ?? "",
      event_ts: msg.eventTs ?? "",
    },
  });
}

export interface SlackHttpRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
}

export interface SlackHttpResponse {
  status: number;
  body: string;
  headers?: Record<string, string>;
}

export async function handleSlackEventsHttp(
  request: SlackHttpRequest,
  env: SlackAdapterEnv,
  core: CoachCore,
): Promise<SlackHttpResponse> {
  const signatureHeader = request.headers["x-slack-signature"];
  const timestampHeader = request.headers["x-slack-request-timestamp"];

  const signature = Array.isArray(signatureHeader)
    ? signatureHeader[0]
    : signatureHeader;
  const timestamp = Array.isArray(timestampHeader)
    ? timestampHeader[0]
    : timestampHeader;

  if (!signature || !timestamp) {
    return { status: 401, body: "missing slack signature headers" };
  }

  const isValid = verifySlackSignature({
    signingSecret: env.SLACK_SIGNING_SECRET,
    timestamp,
    slackSignature: signature,
    rawBody: request.rawBody,
  });

  if (!isValid) {
    return { status: 401, body: "invalid signature" };
  }

  const envelope = JSON.parse(request.rawBody) as SlackEventEnvelope;

  if (envelope.type === "url_verification") {
    return {
      status: 200,
      body: JSON.stringify({ challenge: envelope.challenge ?? "" }),
      headers: { "content-type": "application/json" },
    };
  }

  if (envelope.type !== "event_callback") {
    return { status: 200, body: "ignored" };
  }

  const msg = parseSlackMessageEvent(envelope);
  if (!msg) {
    return { status: 200, body: "ignored" };
  }

  await routeSlackMessageToCore(core, msg);
  return { status: 200, body: "ok" };
}

export function createSocketModeApp(env: SlackAdapterEnv, core: CoachCore) {
  if (!env.SLACK_APP_TOKEN) {
    throw new Error("SLACK_APP_TOKEN is required in socket mode");
  }

  const app = new App({
    token: env.SLACK_BOT_TOKEN,
    signingSecret: env.SLACK_SIGNING_SECRET,
    appToken: env.SLACK_APP_TOKEN,
    socketMode: true,
    logLevel: process.env.NODE_ENV === "development" ? LogLevel.DEBUG : LogLevel.INFO,
  });

  app.event("app_mention", async ({ event, say, body }) => {
    const msg = parseSlackMessageEvent({
      type: "event_callback",
      team_id: body.team_id,
      event,
    });
    if (!msg) return;
    const reply = await routeSlackMessageToCore(core, msg);
    await say({ text: reply, thread_ts: msg.threadTs ?? msg.eventTs });
  });

  app.event("message", async ({ event, say, body }) => {
    const msg = parseSlackMessageEvent({
      type: "event_callback",
      team_id: body.team_id,
      event,
    });
    if (!msg) return;
    const reply = await routeSlackMessageToCore(core, msg);
    await say({ text: reply, thread_ts: msg.threadTs ?? msg.eventTs });
  });

  return app;
}
