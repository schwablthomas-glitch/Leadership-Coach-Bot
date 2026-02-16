# Microsoft Teams Bot Adapter (Node/TS)

Dieser Adapter ist **für 1:1 Chats (Personal Scope)** gebaut.

> Wichtig: Teams Incoming Webhooks sind primär für Channel-Posts. Für 1:1 Chat wird hier ein Bot Framework Bot genutzt.

## Voraussetzungen

1. Azure Bot / Microsoft App registrieren
2. Bot Credentials als Umgebungsvariablen setzen:
   - `TEAMS_APP_ID`
   - `TEAMS_APP_PASSWORD`
   - `ORG_SALT`
   - `PUBLIC_BASE_URL` (z. B. ngrok URL)

## Endpoint

Messaging Endpoint (Bot Framework):

- `POST /api/teams/messages`
- Vollständige URL: `${PUBLIC_BASE_URL}/api/teams/messages`

## Lokal starten

```bash
npm run dev
# oder explizit
npm run dev:teams
```

`dev` und `dev:teams` starten dieselbe App. Webchat bleibt unter `POST /api/chat` verfügbar.

## Bot Framework Emulator

Zum lokalen Testen ohne Teams Tenant:

1. Starte App lokal (`npm run dev:teams`)
2. Öffne Bot Framework Emulator
3. Bot URL: `http://localhost:3000/api/teams/messages`
4. Microsoft App ID / Password wie in `.env`
5. Nachricht senden → Antwort kommt aus der Core Pipeline (safety -> normalize -> coach)

## ngrok Beispiel

Damit Teams den lokalen Endpoint erreichen kann:

```bash
ngrok http 3000
```

Dann:

1. Setze `PUBLIC_BASE_URL=https://<dein-subdomain>.ngrok-free.app`
2. Aktualisiere Bot Messaging Endpoint auf
   `https://<dein-subdomain>.ngrok-free.app/api/teams/messages`
3. Passe `validDomains` in `src/teams/manifest/manifest.json` an.

## Datenschutz & Logging

- `org_id` wird als `teams:<tenantId>` gespeichert.
- User-ID wird aus stabiler Activity-ID (`aadObjectId`/`from.id`) über `pseudonym.ts` mit `ORG_SALT` gehasht.
- Incidents werden getrennt in `data/incidents/incidents.jsonl` gespeichert.
- Es wird kein Klartext der Incidents persistiert (nur Reason + Fingerprint Hash).
