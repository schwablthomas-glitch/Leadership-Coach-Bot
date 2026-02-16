import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  handleSlackEventsHttp,
  mapOrgId,
  parseSlackMessageEvent,
  routeSlackMessageToCore,
  verifySlackSignature,
  type CoachCore,
} from "../src/adapters/slack.js";

function sign(secret: string, ts: string, body: string): string {
  return `v0=${crypto
    .createHmac("sha256", secret)
    .update(`v0:${ts}:${body}`)
    .digest("hex")}`;
}

describe("verifySlackSignature", () => {
  it("accepts a valid signature", () => {
    const body = JSON.stringify({ type: "test" });
    const timestamp = "1710000000";
    const signingSecret = "my-secret";
    const slackSignature = sign(signingSecret, timestamp, body);

    expect(
      verifySlackSignature({
        signingSecret,
        timestamp,
        rawBody: body,
        slackSignature,
        nowSeconds: 1710000001,
      }),
    ).toBe(true);
  });

  it("rejects timestamp outside tolerance", () => {
    const body = JSON.stringify({ type: "test" });
    const timestamp = "1710000000";
    const signingSecret = "my-secret";
    const slackSignature = sign(signingSecret, timestamp, body);

    expect(
      verifySlackSignature({
        signingSecret,
        timestamp,
        rawBody: body,
        slackSignature,
        nowSeconds: 1710001000,
      }),
    ).toBe(false);
  });
});

describe("parseSlackMessageEvent", () => {
  it("parses app_mention and strips mention token", () => {
    const parsed = parseSlackMessageEvent({
      type: "event_callback",
      team_id: "T1",
      event: {
        type: "app_mention",
        user: "U1",
        channel: "C1",
        text: "<@B1> hello coach",
      },
    });

    expect(parsed).toMatchObject({
      teamId: "T1",
      userId: "U1",
      channelId: "C1",
      text: "hello coach",
    });
  });

  it("parses direct message event", () => {
    const parsed = parseSlackMessageEvent({
      type: "event_callback",
      team_id: "T1",
      event: {
        type: "message",
        channel_type: "im",
        user: "U1",
        channel: "D1",
        text: "help me",
      },
    });

    expect(parsed?.text).toBe("help me");
  });
});

describe("core routing and org mapping", () => {
  it("routes parsed message into coach core with mapped org_id", async () => {
    const handleMessage = vi.fn(async () => "coach reply");
    const core: CoachCore = { handleMessage };

    const reply = await routeSlackMessageToCore(core, {
      teamId: "T999",
      userId: "U888",
      text: "How can I delegate better?",
      channelId: "D1",
      eventTs: "123.456",
    });

    expect(reply).toBe("coach reply");
    expect(handleMessage).toHaveBeenCalledTimes(1);
    expect(handleMessage.mock.calls[0][0].org_id).toBe("slack:T999");
    expect(handleMessage.mock.calls[0][0].user_id).toMatch(/^u_[a-f0-9]{24}$/);
  });

  it("maps org_id correctly", () => {
    expect(mapOrgId("TABC")).toBe("slack:TABC");
  });
});

describe("http handler", () => {
  it("verifies signature and routes message event to core", async () => {
    const body = JSON.stringify({
      type: "event_callback",
      team_id: "T1",
      event: {
        type: "message",
        channel_type: "im",
        user: "U1",
        channel: "D1",
        text: "coach me",
      },
    });

    const timestamp = "1710000000";
    const secret = "test-secret";

    const core: CoachCore = {
      handleMessage: vi.fn(async () => "ok"),
    };

    const result = await handleSlackEventsHttp(
      {
        headers: {
          "x-slack-signature": sign(secret, timestamp, body),
          "x-slack-request-timestamp": timestamp,
        },
        rawBody: body,
      },
      {
        SLACK_BOT_TOKEN: "xoxb-test",
        SLACK_SIGNING_SECRET: secret,
      },
      core,
    );

    expect(result.status).toBe(200);
    expect((core.handleMessage as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });
});
