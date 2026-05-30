import { AppState } from '@core/types';
export function renderSettings(host: HTMLElement, _state: AppState, _persist: (s: AppState) => Promise<void>): void {
  host.innerHTML = '<p>偏好設定 — 待實作</p>';
}
