export interface BlockedUser {
  username: string;
  tagIds: string[];
  note: string;
  addedAt: number;
  sourceUrl?: string;
}

export type TagAction = 'fold' | 'hide';

export interface Tag {
  id: string;
  name: string;
  color?: string;
  defaultAction: TagAction;
  builtin: boolean;
}

export interface Settings {
  enabled: boolean;
  defaultActionWhenNoTag: TagAction;
  showHiddenCountBadge: boolean;
  debugMode: boolean;
}

export interface AppState {
  schemaVersion: number;
  blockedUsers: Record<string, BlockedUser>;
  tags: Tag[];
  settings: Settings;
}

export const CURRENT_SCHEMA_VERSION = 1;
