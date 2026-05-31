import { AppState } from './types';
import { emptyState, DEFAULT_SETTINGS } from './defaults';

export const STORAGE_KEY = 'block_all_state';

export async function loadState(): Promise<AppState> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as AppState | undefined;
  if (!stored) return emptyState();
  return { ...stored, settings: { ...DEFAULT_SETTINGS, ...stored.settings } };
}

export async function saveState(state: AppState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export type StateListener = (next: AppState) => void;

export function subscribeState(listener: StateListener): () => void {
  const wrapped = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local') return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    listener(change.newValue as AppState);
  };
  chrome.storage.onChanged.addListener(wrapped);
  return () => chrome.storage.onChanged.removeListener(wrapped);
}
