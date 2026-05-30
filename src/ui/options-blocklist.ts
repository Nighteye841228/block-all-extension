import { AppState } from '@core/types';
export function renderBlocklist(host: HTMLElement, _state: AppState, _persist: (s: AppState) => Promise<void>): void {
  host.innerHTML = '<p>黑名單 — 待實作</p>';
}
