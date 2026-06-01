import { AppState, Settings, Tag, CURRENT_SCHEMA_VERSION } from './types';

export const DEFAULT_TAGS: Tag[] = [
  { id: 'sys:sexism',   name: '性別歧視', color: '#d946ef', defaultAction: 'fold', builtin: true },
  { id: 'sys:violence', name: '暴力',     color: '#ef4444', defaultAction: 'fold', builtin: true },
  { id: 'sys:gross',    name: '噁心',     color: '#84cc16', defaultAction: 'fold', builtin: true },
];

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  defaultAction: 'fold',
  showHiddenCountBadge: true,
  showSourceUrlInBanner: false,
  debugMode: false,
};

export function emptyState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    blockedUsers: {},
    tags: structuredClone(DEFAULT_TAGS),
    settings: { ...DEFAULT_SETTINGS },
  };
}
