import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const INCIDENTS_FILE = 'data/incidents/incidents.jsonl';

export interface IncidentRecord {
  timestamp: string;
  org_id: string;
  user_id: string;
  reason: string;
  fingerprint: string;
}

export async function logIncident(record: IncidentRecord): Promise<void> {
  await mkdir(dirname(INCIDENTS_FILE), { recursive: true });
  await appendFile(INCIDENTS_FILE, `${JSON.stringify(record)}\n`, 'utf8');
}
