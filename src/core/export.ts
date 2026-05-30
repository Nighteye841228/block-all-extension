import { AppState, BlockedUser, Tag, Settings, CURRENT_SCHEMA_VERSION } from './types';

export interface ImportPayload {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  blockedUsers: BlockedUser[];
  tags: Tag[];
  settings: Settings;
}

export function serializeExport(state: AppState, appVersion: string): string {
  const payload: ImportPayload = {
    schemaVersion: state.schemaVersion,
    exportedAt: new Date().toISOString(),
    appVersion,
    blockedUsers: Object.values(state.blockedUsers),
    tags: state.tags,
    settings: state.settings,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseImport(json: string): ImportPayload {
  const data = JSON.parse(json);
  if (data?.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported schemaVersion ${data?.schemaVersion}`);
  }
  if (!Array.isArray(data.blockedUsers)) throw new Error('blockedUsers must be an array');
  if (!Array.isArray(data.tags)) throw new Error('tags must be an array');
  if (!data.settings) throw new Error('settings missing');
  return data as ImportPayload;
}

export interface MergeOptions {
  mode: 'merge' | 'replace';
}

export function mergeImport(base: AppState, incoming: ImportPayload, opts: MergeOptions): AppState {
  const next: AppState = {
    schemaVersion: base.schemaVersion,
    blockedUsers: opts.mode === 'replace' ? {} : { ...base.blockedUsers },
    tags: [...base.tags],
    settings: { ...base.settings },
  };

  for (const u of incoming.blockedUsers) {
    next.blockedUsers[u.username] = u;
  }

  const existingById = new Map(next.tags.map(t => [t.id, t]));
  for (const t of incoming.tags) {
    if (t.builtin) continue;
    const existing = existingById.get(t.id);
    if (!existing) {
      next.tags.push(t);
      existingById.set(t.id, t);
    } else if (existing.name !== t.name) {
      const renamed = { ...t, id: `${t.id}_imported` };
      next.tags.push(renamed);
      existingById.set(renamed.id, renamed);
    }
  }

  return next;
}
