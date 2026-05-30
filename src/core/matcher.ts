import { AppState, BlockedUser, TagAction } from './types';

export function findBlockedUser(state: AppState, username: string): BlockedUser | null {
  if (!username) return null;
  return state.blockedUsers[username] ?? null;
}

export function resolveAction(state: AppState, user: BlockedUser): TagAction {
  if (user.tagIds.length === 0) return state.settings.defaultActionWhenNoTag;
  const tagsById = new Map(state.tags.map(t => [t.id, t]));
  const actions = user.tagIds.map(id => tagsById.get(id)?.defaultAction).filter(Boolean) as TagAction[];
  if (actions.length === 0) return state.settings.defaultActionWhenNoTag;
  return actions.includes('hide') ? 'hide' : 'fold';
}
