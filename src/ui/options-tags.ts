import { AppState } from '@core/types';
export function renderTags(host: HTMLElement, _state: AppState, _persist: (s: AppState) => Promise<void>): void {
  host.innerHTML = '<p>標籤 — 待實作</p>';
}
