# Leadership Coach Bot

Node.js 20 + TypeScript Projekt mit minimalem Web-Chat, REST API, WebSocket und SQLite-Speicher.

## Features
- Web-Chat UI unter `http://localhost:3000`
- Endpoints:
  - `POST /api/chat` → `{ reply, session_id }`
  - `POST /api/feedback`
  - `GET /health`
- Pseudonymisierung via SHA-256 (`user_handle + ORG_SALT`)
- Session-State pro `user_id` (eine aktive Session), Memory Window: 12 Messages
- Safety-Routing für Krise/Gewalt/medizinische Inhalte
- Retention-Job: `npm run retention`
- Unit Tests (Node Test Runner)

## Setup
1. Node.js 20 nutzen.
2. `.env.example` nach `.env` kopieren und ausfüllen.
3. Build & Start:
   ```bash
   npm run build
   npm run dev
   ```

> Hinweis: `npm run dev` baut einmal und startet dann den Server.

## ENV Variablen
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4.1-mini`)
- `ORG_SALT` (required)
- `RETENTION_DAYS` (default: `30`)
- `PORT` (default: `3000`)
- `DB_PATH` (default: `./data/coach.sqlite`)
- `OPENAI_TIMEOUT_MS` (default: `10000`)

## API Beispiele
### Chat
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"org_id":"demo-org","user_handle":"alice","text":"Ich prokrastiniere bei schwierigen Gesprächen."}'
```

### Feedback
```bash
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"session_id":1,"rating":5,"note":"Hilfreich"}'
```

### Health
```bash
curl http://localhost:3000/health
```

## Retention
```bash
npm run retention
```
Löscht Nachrichten älter als `RETENTION_DAYS`.

## Tests
```bash
npm test
```
## Development

```bash
npm run dev
```

- Webchat/Test endpoint: `POST /api/chat`
- Teams messaging endpoint: `POST /api/teams/messages`

Weitere Teams-Setup-Infos: `src/teams/README_TEAMS.md`.
