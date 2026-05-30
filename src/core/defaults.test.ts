import { describe, it, expect } from 'vitest';
import { DEFAULT_TAGS, DEFAULT_SETTINGS, emptyState } from './defaults';
import { CURRENT_SCHEMA_VERSION } from './types';

describe('defaults', () => {
  it('exposes three builtin tags', () => {
    expect(DEFAULT_TAGS).toHaveLength(3);
    expect(DEFAULT_TAGS.every(t => t.builtin)).toBe(true);
    expect(DEFAULT_TAGS.map(t => t.id)).toEqual(['sys:sexism', 'sys:violence', 'sys:gross']);
  });

  it('default settings enable extension and fold-when-no-tag', () => {
    expect(DEFAULT_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_SETTINGS.defaultActionWhenNoTag).toBe('fold');
  });

  it('emptyState carries current schema version, empty users, default tags and settings', () => {
    const s = emptyState();
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(s.blockedUsers).toEqual({});
    expect(s.tags).toEqual(DEFAULT_TAGS);
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
  });
});
