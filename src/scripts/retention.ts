// @ts-nocheck
import { loadConfig } from '../config.js';
import { SQLiteStore } from '../core/store.js';

const config = loadConfig();
const store = new SQLiteStore(config.dbPath);
store.init();

const deleted = store.retentionDelete(config.retentionDays);
console.log(`Retention ausgeführt. Gelöschte Messages: ${deleted}`);
