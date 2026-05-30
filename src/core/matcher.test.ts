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

  it('resolveAction returns first matching tag action', () => {
    const s = emptyState();
    s.tags.push({ id: 'user:hide-this', name: 'hide-this', defaultAction: 'hide', builtin: false });
    const u: BlockedUser = { username: 'a', tagIds: ['user:hide-this'], note: '', addedAt: 1 };
    expect(resolveAction(s, u)).toBe('hide');
  });

  it('resolveAction falls back to settings.defaultActionWhenNoTag when no tags', () => {
    const s = emptyState();
    s.settings.defaultActionWhenNoTag = 'hide';
    const u: BlockedUser = { username: 'a', tagIds: [], note: '', addedAt: 1 };
    expect(resolveAction(s, u)).toBe('hide');
  });

  it('resolveAction prefers hide over fold when any tag wants hide', () => {
    const s = emptyState();
    s.tags.push({ id: 'user:hide-it', name: 'h', defaultAction: 'hide', builtin: false });
    const u: BlockedUser = { username: 'a', tagIds: ['sys:sexism', 'user:hide-it'], note: '', addedAt: 1 };
    expect(resolveAction(s, u)).toBe('hide');
  });
});
