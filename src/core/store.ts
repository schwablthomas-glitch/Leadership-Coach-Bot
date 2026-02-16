// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Message, Session } from './types.js';

export class SQLiteStore {
  constructor(private readonly dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  private run(sql: string): string {
    return execFileSync('sqlite3', [this.dbPath, sql], { encoding: 'utf8' });
  }

  private esc(value: string): string {
    return value.replaceAll("'", "''");
  }

  private queryJSON<T>(sql: string): T[] {
    const out = execFileSync('sqlite3', ['-json', this.dbPath, sql], { encoding: 'utf8' }).trim();
    if (!out) return [];
    return JSON.parse(out) as T[];
  }

  init(): void {
    this.run(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_active_session ON sessions(org_id, user_id, is_active);

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        category TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  getOrCreateActiveSession(orgId: string, userId: string): Session {
    const existing = this.queryJSON<any>(`SELECT * FROM sessions WHERE org_id='${this.esc(orgId)}' AND user_id='${this.esc(userId)}' AND is_active=1 LIMIT 1;`)[0];
    if (existing) return this.mapSession(existing);

    this.run(`INSERT INTO sessions(org_id, user_id, is_active) VALUES('${this.esc(orgId)}', '${this.esc(userId)}', 1);`);
    const created = this.queryJSON<any>('SELECT * FROM sessions ORDER BY id DESC LIMIT 1;')[0];
    return this.mapSession(created);
  }

  touchSession(sessionId: number): void {
    this.run(`UPDATE sessions SET updated_at=CURRENT_TIMESTAMP WHERE id=${sessionId};`);
  }

  addMessage(sessionId: number, role: 'user' | 'assistant' | 'system', text: string): void {
    const escaped = this.esc(text);
    this.run(`INSERT INTO messages(session_id, role, text) VALUES(${sessionId}, '${role}', '${escaped}');`);
    this.trimMemoryWindow(sessionId, 12);
    this.touchSession(sessionId);
  }

  getRecentMessages(sessionId: number, limit = 12): Message[] {
    const rows = this.queryJSON<any>(`SELECT * FROM messages WHERE session_id=${sessionId} ORDER BY id DESC LIMIT ${limit};`);
    return rows.reverse().map(this.mapMessage);
  }

  addFeedback(sessionId: number, rating: number, note?: string): void {
    const escaped = this.esc(note ?? '');
    this.run(`INSERT INTO feedback(session_id, rating, note) VALUES(${sessionId}, ${rating}, '${escaped}');`);
  }

  addIncident(sessionId: number | null, category: string, text: string): void {
    const escaped = this.esc(text);
    const sid = sessionId === null ? 'NULL' : String(sessionId);
    this.run(`INSERT INTO incidents(session_id, category, text) VALUES(${sid}, '${this.esc(category)}', '${escaped}');`);
  }

  retentionDelete(retentionDays: number): number {
    const before = this.queryJSON<{ c: number }>('SELECT COUNT(*) as c FROM messages;')[0]?.c ?? 0;
    this.run(`DELETE FROM messages WHERE datetime(created_at) < datetime('now', '-${retentionDays} days');`);
    const after = this.queryJSON<{ c: number }>('SELECT COUNT(*) as c FROM messages;')[0]?.c ?? 0;
    return before - after;
  }

  private trimMemoryWindow(sessionId: number, window: number): void {
    this.run(`
      DELETE FROM messages
      WHERE session_id=${sessionId}
      AND id NOT IN (
        SELECT id FROM messages WHERE session_id=${sessionId} ORDER BY id DESC LIMIT ${window}
      );
    `);
  }

  private mapSession = (row: any): Session => ({
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  private mapMessage = (row: any): Message => ({
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    text: row.text,
    createdAt: row.created_at,
  });
}
