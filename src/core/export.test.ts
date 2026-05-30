import { describe, it, expect } from 'vitest';
import { serializeExport, parseImport, mergeImport, ImportPayload } from './export';
import { emptyState } from './defaults';

describe('export/import', () => {
  it('serializeExport produces JSON with schemaVersion, exportedAt, blockedUsers as array', () => {
    const s = emptyState();
    s.blockedUsers['alice'] = { username: 'alice', tagIds: [], note: '', addedAt: 1 };
    const json = JSON.parse(serializeExport(s, '0.1.0'));
    expect(json.schemaVersion).toBe(1);
    expect(typeof json.exportedAt).toBe('string');
    expect(json.appVersion).toBe('0.1.0');
    expect(Array.isArray(json.blockedUsers)).toBe(true);
    expect(json.blockedUsers[0].username).toBe('alice');
  });

  it('parseImport rejects wrong schema', () => {
    expect(() => parseImport('{"schemaVersion":999}')).toThrow();
  });

  it('parseImport returns ImportPayload', () => {
    const s = emptyState();
    const json = serializeExport(s, '0.1.0');
    const parsed = parseImport(json);
    expect(parsed.blockedUsers).toEqual([]);
  });

  it('mergeImport in merge mode keeps existing entries and adds new ones, imported wins on conflict', () => {
    const base = emptyState();
    base.blockedUsers['alice'] = { username: 'alice', tagIds: ['sys:sexism'], note: 'orig', addedAt: 1 };
    const incoming: ImportPayload = {
      schemaVersion: 1,
      exportedAt: '2026-05-30T00:00:00.000Z',
      appVersion: '0.1.0',
      blockedUsers: [
        { username: 'alice', tagIds: ['sys:violence'], note: 'new', addedAt: 2 },
        { username: 'bob', tagIds: [], note: '', addedAt: 3 },
      ],
      tags: base.tags,
      settings: base.settings,
    };
    const merged = mergeImport(base, incoming, { mode: 'merge' });
    expect(merged.blockedUsers['alice']?.note).toBe('new');
    expect(merged.blockedUsers['alice']?.tagIds).toEqual(['sys:violence']);
    expect(merged.blockedUsers['bob']).toBeTruthy();
  });

  it('mergeImport in replace mode wipes existing blockedUsers', () => {
    const base = emptyState();
    base.blockedUsers['alice'] = { username: 'alice', tagIds: [], note: '', addedAt: 1 };
    const incoming: ImportPayload = {
      schemaVersion: 1,
      exportedAt: 'x', appVersion: '0.1.0',
      blockedUsers: [{ username: 'bob', tagIds: [], note: '', addedAt: 2 }],
      tags: base.tags,
      settings: base.settings,
    };
    const merged = mergeImport(base, incoming, { mode: 'replace' });
    expect(merged.blockedUsers['alice']).toBeUndefined();
    expect(merged.blockedUsers['bob']).toBeTruthy();
  });

  it('mergeImport suffixes custom tag id collisions with different names', () => {
    const base = emptyState();
    base.tags.push({ id: 'user:abc', name: 'orig', defaultAction: 'fold', builtin: false });
    const incoming: ImportPayload = {
      schemaVersion: 1,
      exportedAt: 'x', appVersion: '0.1.0',
      blockedUsers: [],
      tags: [...base.tags.slice(0, 3), { id: 'user:abc', name: 'other', defaultAction: 'fold', builtin: false }],
      settings: base.settings,
    };
    const merged = mergeImport(base, incoming, { mode: 'merge' });
    expect(merged.tags.find(t => t.id === 'user:abc_imported')?.name).toBe('other');
    expect(merged.tags.find(t => t.id === 'user:abc')?.name).toBe('orig');
  });
});
