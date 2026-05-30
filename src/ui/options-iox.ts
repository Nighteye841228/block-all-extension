import { AppState } from '@core/types';
export function renderIox(host: HTMLElement, _state: AppState, _persist: (s: AppState) => Promise<void>): void {
  host.innerHTML = '<p>匯入 / 匯出 — 待實作</p>';
}
