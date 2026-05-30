import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadState, saveState, subscribeState, STORAGE_KEY } from './storage';
import { emptyState } from './defaults';

type Listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;

beforeEach(() => {
  const storage: Record<string, unknown> = {};
  const listeners: Listener[] = [];
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn((keys: string | string[] | null) => {
          if (keys === null) return Promise.resolve({ ...storage });
          const arr = Array.isArray(keys) ? keys : [keys as string];
          const result: Record<string, unknown> = {};
          for (const k of arr) if (k in storage) result[k] = storage[k];
          return Promise.resolve(result);
        }),
        set: vi.fn((items: Record<string, unknown>) => {
          const changes: Record<string, chrome.storage.StorageChange> = {};
          for (const [k, v] of Object.entries(items)) {
            changes[k] = { oldValue: storage[k], newValue: v };
            storage[k] = v;
          }
          for (const l of listeners) l(changes, 'local');
          return Promise.resolve();
        }),
      },
      onChanged: {
        addListener: vi.fn((l: Listener) => listeners.push(l)),
        removeListener: vi.fn((l: Listener) => {
          const i = listeners.indexOf(l);
          if (i >= 0) listeners.splice(i, 1);
        }),
      },
    },
  };
});

describe('storage', () => {
  it('loadState returns emptyState() when nothing stored', async () => {
    const s = await loadState();
    expect(s).toEqual(emptyState());
  });

  it('saveState round-trips', async () => {
    const s = emptyState();
    s.blockedUsers['alice'] = { username: 'alice', tagIds: [], note: '', addedAt: 1 };
    await saveState(s);
    const loaded = await loadState();
    expect(loaded.blockedUsers['alice']?.username).toBe('alice');
  });

  it('subscribeState fires on storage change', async () => {
    const s = emptyState();
    const cb = vi.fn();
    const unsubscribe = subscribeState(cb);
    await saveState(s);
    expect(cb).toHaveBeenCalledTimes(1);
    unsubscribe();
    await saveState(s);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('uses the expected storage key', () => {
    expect(STORAGE_KEY).toBe('block_all_state');
  });
});
