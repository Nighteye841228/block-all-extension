import { describe, it, expect } from 'vitest';
import { findBlockedUser, resolveAction } from './matcher';
import { emptyState } from './defaults';
import { AppState, BlockedUser } from './types';

function state(users: BlockedUser[]): AppState {
  const s = emptyState();
  for (const u of users) s.blockedUsers[u.username] = u;
  return s;
}

describe('matcher', () => {
  it('returns the blocked user when present', () => {
    const s = state([{ username: 'alice', tagIds: [], note: '', addedAt: 1 }]);
    expect(findBlockedUser(s, 'alice')?.username).toBe('alice');
  });

  it('returns null when missing', () => {
    expect(findBlockedUser(emptyState(), 'nobody')).toBeNull();
  });

  it('returns null when username argument is empty', () => {
    expect(findBlockedUser(emptyState(), '')).toBeNull();
  });

  it('resolveAction uses settings.defaultAction (fold by default)', () => {
    const s = emptyState();
    const u: BlockedUser = { username: 'a', tagIds: ['sys:sexism'], note: '', addedAt: 1 };
    expect(resolveAction(s, u)).toBe('fold');
  });

  it('resolveAction returns hide when global setting is hide, regardless of tags', () => {
    const s = emptyState();
    s.settings.defaultAction = 'hide';
    const tagged: BlockedUser = { username: 'a', tagIds: ['sys:sexism'], note: '', addedAt: 1 };
    const untagged: BlockedUser = { username: 'b', tagIds: [], note: '', addedAt: 1 };
    expect(resolveAction(s, tagged)).toBe('hide');
    expect(resolveAction(s, untagged)).toBe('hide');
  });
});
