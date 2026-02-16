# Slack Adapter Setup (Events API + optional Socket Mode)

Diese Anleitung richtet die Slack App so ein, dass Nachrichten per **Events API** unter
`/api/slack/events` empfangen und an den Coach Core weitergeleitet werden.

## 1) Dependencies installieren

```bash
npm install
```

Enthalten ist `@slack/bolt` für Socket Mode und Event-Handling.

## 2) Slack App konfigurieren

1. Öffne https://api.slack.com/apps → **Create New App**.
2. Unter **Basic Information** notiere:
   - `Signing Secret` → `SLACK_SIGNING_SECRET`
3. Unter **OAuth & Permissions**:
   - Bot Scopes hinzufügen:
     - `app_mentions:read`
     - `channels:history`
     - `chat:write`
     - `im:history`
     - `im:read`
   - App ins Workspace installieren.
   - `Bot User OAuth Token` notieren → `SLACK_BOT_TOKEN`

## 3) Events API aktivieren (HTTP Mode)

1. Unter **Event Subscriptions** → **Enable Events**.
2. Request URL setzen auf:
   - lokal via ngrok: `https://<dein-subdomain>.ngrok.io/api/slack/events`
3. **Subscribe to bot events**:
   - `app_mention`
   - `message.im`
4. Änderungen speichern.

## 4) ENV Variablen

```bash
export SLACK_MODE=http
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_SIGNING_SECRET=...
# nur Socket Mode:
export SLACK_APP_TOKEN=xapp-...
```

Defaults:
- `SLACK_MODE` default = `http`

Mapping im Adapter:
- `org_id = "slack:<teamId>"`
- `user_id = sha256("slack:<teamId>:<slackUserId>:<salt>")` (pseudonymisiert)

## 5) HTTP Endpoint im Server verdrahten

Der Adapter erwartet den **raw request body** zur Signaturprüfung.

Beispiel (pseudo):

```ts
app.post("/api/slack/events", async (req, res) => {
  const result = await handleSlackEventsHttp(
    {
      headers: req.headers,
      rawBody: req.rawBody,
    },
    {
      SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN!,
      SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET!,
      SLACK_MODE: (process.env.SLACK_MODE as "http" | "socket") ?? "http",
    },
    coachCore,
  );

  if (result.headers) {
    for (const [k, v] of Object.entries(result.headers)) {
      res.setHeader(k, v);
    }
  }
  res.status(result.status).send(result.body);
});
```

## 6) Optional: Socket Mode

1. Unter **Socket Mode** aktivieren.
2. App-Level Token mit Scope `connections:write` erstellen.
3. In ENV setzen:

```bash
export SLACK_MODE=socket
export SLACK_APP_TOKEN=xapp-...
```

4. App starten:

```ts
const app = createSocketModeApp(env, coachCore);
await app.start();
```

## 7) Lokaltest via ngrok

1. App lokal starten (Port z. B. 3000)
2. ngrok starten:

```bash
ngrok http 3000
```

3. Die https URL in Slack Event Subscriptions eintragen.
4. Bot im Channel erwähnen (`@bot`) oder DM senden.

Erwartung:
- `app_mention` und DMs (`message.im`) werden vom Adapter erkannt
- Nachricht wird an den Coach Core geleitet
- Antwort wird im Thread oder DM zurückgegeben (Socket Mode über `say`, HTTP über Core-Routing im Host-Server)
