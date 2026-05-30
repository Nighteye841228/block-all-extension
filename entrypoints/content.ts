import { loadState, saveState, subscribeState } from '@core/storage';
import { normalizeUsername } from '@core/normalize';
import { AppState } from '@core/types';
import { attachObserver, createProcessor } from '@content/observer';
import { injectBlockButton } from '@content/block-button';
import { extractAuthorUsername } from '@content/extractor';
import { SELECTORS } from '@content/selectors';

export default defineContentScript({
  matches: ['https://*.threads.com/*', 'https://*.threads.net/*'],
  runAt: 'document_idle',
  async main() {
    let state: AppState = await loadState();
    const processor = createProcessor(() => state);

    const decorate = (container: HTMLElement) => {
      const u = extractAuthorUsername(container);
      if (!u) return;
      injectBlockButton(container, u, async name => {
        const username = normalizeUsername(name);
        if (state.blockedUsers[username]) return;
        state.blockedUsers[username] = {
          username, tagIds: [], note: '',
          addedAt: Date.now(), sourceUrl: location.href,
        };
        await saveState(state);
      });
    };

    processor.enqueueAll(document);
    document.querySelectorAll<HTMLElement>(SELECTORS.postContainer).forEach(decorate);

    attachObserver(document.body, el => { processor.enqueue(el); decorate(el); });
    subscribeState(next => { state = next; processor.enqueueAll(document); });

    if (state.settings.debugMode) console.log('[block-all] content loaded', state);
  },
});
