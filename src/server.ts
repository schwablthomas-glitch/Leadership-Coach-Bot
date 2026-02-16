// @ts-nocheck
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { loadConfig } from './config.js';
import { normalize, coachRespond } from './core/coach.js';
import { pseudonymize } from './core/pseudonym.js';
import { safetyRouter } from './core/safety.js';
import { SQLiteStore } from './core/store.js';

const config = loadConfig();
const store = new SQLiteStore(config.dbPath);
store.init();

function json(res: any, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString('utf8');
      if (data.length > 1_000_000) reject(new Error('Payload zu groß'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function handleChat(body: any): Promise<{ reply: string; session_id: number }> {
  const { org_id, user_handle, text } = body ?? {};
  if (!org_id || !user_handle || !text) {
    throw new Error('org_id, user_handle und text sind erforderlich.');
  }

  const userId = pseudonymize(String(user_handle), config.orgSalt);
  const session = store.getOrCreateActiveSession(String(org_id), userId);

  const safety = safetyRouter(String(text));
  store.addMessage(session.id, 'user', String(text));

  if (safety.route === 'escalation') {
    store.addIncident(session.id, 'safety_escalation', String(text));
    const escalationReply = safety.text ?? 'Ich kann dabei nicht helfen.';
    store.addMessage(session.id, 'assistant', escalationReply);
    return { reply: escalationReply, session_id: session.id };
  }

  const history = store.getRecentMessages(session.id, 12);
  const normalized = await normalize(String(text), {
    apiKey: config.openAIApiKey,
    model: config.openAIModel,
    timeoutMs: config.openAITimeoutMs,
  });
  const reply = await coachRespond(normalized, history, {
    apiKey: config.openAIApiKey,
    model: config.openAIModel,
    timeoutMs: config.openAITimeoutMs,
  });
  store.addMessage(session.id, 'assistant', reply);

  return { reply, session_id: session.id };
}

const server = createServer(async (req, res) => {
  try {
    const method = req.method ?? 'GET';
    const url = req.url ?? '/';

    if (method === 'GET' && url === '/health') {
      return json(res, 200, { status: 'ok' });
    }

    if (method === 'POST' && url === '/api/chat') {
      const body = await parseBody(req);
      const result = await handleChat(body);
      return json(res, 200, { reply: result.reply, session_id: result.session_id });
    }

    if (method === 'POST' && url === '/api/feedback') {
      const body = await parseBody(req);
      if (!body.session_id || !body.rating) {
        return json(res, 400, { error: 'session_id und rating erforderlich.' });
      }
      store.addFeedback(Number(body.session_id), Number(body.rating), body.note ? String(body.note) : undefined);
      return json(res, 200, { ok: true });
    }

    if (method === 'GET' && (url === '/' || url.startsWith('/public/'))) {
      const filePath = url === '/' ? 'public/index.html' : url.slice(1);
      const data = readFileSync(filePath);
      const ext = extname(filePath);
      const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : 'text/plain';
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
      res.end(data);
      return;
    }

    json(res, 404, { error: 'Not found' });
  } catch (error) {
    json(res, 500, { error: String(error) });
  }
});

function websocketAccept(key: string): string {
  return createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
}

function decodeTextFrame(buffer: Buffer): string {
  const payloadLength = buffer[1] & 0x7f;
  const masked = (buffer[1] & 0x80) === 0x80;
  let offset = 2;
  if (payloadLength === 126) offset = 4;
  if (payloadLength === 127) offset = 10;

  const mask = masked ? buffer.subarray(offset, offset + 4) : Buffer.alloc(0);
  offset += masked ? 4 : 0;
  const payload = buffer.subarray(offset);

  if (masked) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= mask[i % 4]!;
    }
  }
  return payload.toString('utf8');
}

function encodeTextFrame(text: string): Buffer {
  const payload = Buffer.from(text);
  const frame = Buffer.alloc(payload.length + 2);
  frame[0] = 0x81;
  frame[1] = payload.length;
  payload.copy(frame, 2);
  return frame;
}

server.on('upgrade', (req, socket) => {
  if (req.url !== '/ws') return socket.destroy();
  const key = req.headers['sec-websocket-key'];
  if (!key || Array.isArray(key)) return socket.destroy();

  const accept = websocketAccept(key);
  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '',
      '',
    ].join('\r\n'),
  );

  socket.on('data', async (raw) => {
    try {
      const txt = decodeTextFrame(raw);
      const body = JSON.parse(txt);
      const result = await handleChat(body);
      socket.write(encodeTextFrame(JSON.stringify(result)));
    } catch (error) {
      socket.write(encodeTextFrame(JSON.stringify({ error: String(error) })));
    }
  });
});

server.listen(config.port, () => {
  console.log(`Server läuft auf http://localhost:${config.port}`);
});
