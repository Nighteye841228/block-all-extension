import { AppState, BlockedUser, TagAction } from './types';

export function findBlockedUser(state: AppState, username: string): BlockedUser | null {
  if (!username) return null;
  return state.blockedUsers[username] ?? null;
}

export function resolveAction(state: AppState, _user: BlockedUser): TagAction {
  return state.settings.defaultAction;
}
