// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { SQLiteStore } from '../core/store.js';

function makeStore(path: string): SQLiteStore {
  rmSync(path, { force: true });
  const store = new SQLiteStore(path);
  store.init();
  return store;
}

test('store creates one active session per user_id', () => {
  const db = './data/test-session.sqlite';
  const store = makeStore(db);

  const first = store.getOrCreateActiveSession('orgA', 'u1');
  const second = store.getOrCreateActiveSession('orgA', 'u1');
  assert.equal(first.id, second.id);
});

test('store keeps memory window at 12 messages', () => {
  const db = './data/test-window.sqlite';
  const store = makeStore(db);
  const session = store.getOrCreateActiveSession('orgA', 'u2');

  for (let i = 1; i <= 20; i++) {
    store.addMessage(session.id, 'user', `msg-${i}`);
  }

  const messages = store.getRecentMessages(session.id, 50);
  assert.equal(messages.length, 12);
  assert.equal(messages[0]?.text, 'msg-9');
  assert.equal(messages[11]?.text, 'msg-20');
});

test('retentionDelete removes old messages', () => {
  const db = './data/test-retention.sqlite';
  const store = makeStore(db);
  const session = store.getOrCreateActiveSession('orgA', 'u3');

  store.addMessage(session.id, 'user', 'aktuell');
  execFileSync('sqlite3', [db, `UPDATE messages SET created_at = datetime('now', '-40 days') WHERE text='aktuell';`]);
  store.addMessage(session.id, 'assistant', 'neu');

  const deleted = store.retentionDelete(30);
  assert.equal(deleted, 1);

  const rows = execFileSync('sqlite3', ['-json', db, 'SELECT text FROM messages ORDER BY id;'], { encoding: 'utf8' });
  assert.ok(rows.includes('neu'));
  assert.ok(!rows.includes('aktuell'));
});
