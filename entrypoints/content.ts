import { loadState, subscribeState } from '@core/storage';
import { AppState } from '@core/types';
import { attachObserver, createProcessor } from '@content/observer';

export default defineContentScript({
  matches: ['https://*.threads.com/*', 'https://*.threads.net/*'],
  runAt: 'document_idle',
  async main() {
    let state: AppState = await loadState();
    const processor = createProcessor(() => state);
    processor.enqueueAll(document);
    attachObserver(document.body, el => processor.enqueue(el));
    subscribeState(next => { state = next; processor.enqueueAll(document); });
    if (state.settings.debugMode) console.log('[block-all] content loaded', state);
  },
});
