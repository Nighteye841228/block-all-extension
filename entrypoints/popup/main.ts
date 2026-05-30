import { loadState, saveState, subscribeState } from '@core/storage';
import { AppState } from '@core/types';

let state: AppState;

async function init() {
  state = await loadState();
  render();
  subscribeState(next => { state = next; render(); });
}

function render() {
  const app = document.getElementById('app')!;
  const blockedCount = Object.keys(state.blockedUsers).length;
  app.innerHTML = `
    <h1>Block-All for Threads</h1>
    <div class="row">
      <span>啟用</span>
      <input id="enabled" type="checkbox" ${state.settings.enabled ? 'checked' : ''}>
    </div>
    <div class="stat">已封鎖 ${blockedCount} 個帳號</div>
    <button id="open-options">開啟完整管理頁</button>
  `;
  document.getElementById('enabled')!.addEventListener('change', async e => {
    state.settings.enabled = (e.target as HTMLInputElement).checked;
    await saveState(state);
  });
  document.getElementById('open-options')!.addEventListener('click', () => chrome.runtime.openOptionsPage());
}

init();
