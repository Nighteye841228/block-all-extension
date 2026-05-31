import { AppState } from '@core/types';

export function renderSettings(host: HTMLElement, state: AppState, persist: (s: AppState) => Promise<void>): void {
  host.innerHTML = `
    <div class="field">
      <label for="default-action">無標籤時的預設行為</label>
      <select id="default-action" name="defaultActionWhenNoTag">
        <option value="fold" ${state.settings.defaultActionWhenNoTag === 'fold' ? 'selected' : ''}>折疊（顯示橫幅可展開）</option>
        <option value="hide" ${state.settings.defaultActionWhenNoTag === 'hide' ? 'selected' : ''}>隱藏（display:none）</option>
      </select>
    </div>
    <div class="field">
      <label><input type="checkbox" name="showHiddenCountBadge" ${state.settings.showHiddenCountBadge ? 'checked' : ''}> 在 popup 顯示本頁折疊計數</label>
    </div>
    <div class="field">
      <label><input type="checkbox" name="showSourceUrlInBanner" ${state.settings.showSourceUrlInBanner ? 'checked' : ''}> 在封鎖橫幅顯示加入來源連結</label>
    </div>
    <div class="field">
      <label><input type="checkbox" name="debugMode" ${state.settings.debugMode ? 'checked' : ''}> 除錯模式（console 紀錄）</label>
    </div>
  `;
  host.querySelector<HTMLSelectElement>('[name="defaultActionWhenNoTag"]')!.addEventListener('change', async e => {
    state.settings.defaultActionWhenNoTag = (e.target as HTMLSelectElement).value as 'fold' | 'hide';
    await persist(state);
  });
  host.querySelector<HTMLInputElement>('[name="showHiddenCountBadge"]')!.addEventListener('change', async e => {
    state.settings.showHiddenCountBadge = (e.target as HTMLInputElement).checked;
    await persist(state);
  });
  host.querySelector<HTMLInputElement>('[name="showSourceUrlInBanner"]')!.addEventListener('change', async e => {
    state.settings.showSourceUrlInBanner = (e.target as HTMLInputElement).checked;
    await persist(state);
  });
  host.querySelector<HTMLInputElement>('[name="debugMode"]')!.addEventListener('change', async e => {
    state.settings.debugMode = (e.target as HTMLInputElement).checked;
    await persist(state);
  });
}
