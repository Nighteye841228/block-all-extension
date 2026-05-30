import { loadState, saveState, subscribeState } from '@core/storage';
import { AppState } from '@core/types';
import { renderBlocklist } from '@ui/options-blocklist';
import { renderTags } from '@ui/options-tags';
import { renderSettings } from '@ui/options-settings';
import { renderIox } from '@ui/options-iox';

let state: AppState;
let currentTab: 'blocklist' | 'tags' | 'settings' | 'iox' = 'blocklist';

async function init() {
  state = await loadState();
  setupTabs();
  rerender();
  subscribeState(next => { state = next; rerender(); });
}

function setupTabs() {
  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab as typeof currentTab;
      rerender();
    });
  });
}

function rerender() {
  const main = document.getElementById('main')!;
  main.innerHTML = '';
  const persist = async (next: AppState) => { state = next; await saveState(state); rerender(); };
  switch (currentTab) {
    case 'blocklist': renderBlocklist(main, state, persist); break;
    case 'tags':      renderTags(main, state, persist); break;
    case 'settings':  renderSettings(main, state, persist); break;
    case 'iox':       renderIox(main, state, persist); break;
  }
}

init();
