import { loadState, saveState, subscribeState } from '@core/storage';
import { normalizeUsername } from '@core/normalize';
import { AppState } from '@core/types';
import { attachObserver, createProcessor } from '@content/observer';
import { injectBlockButton } from '@content/block-button';
import { extractAuthorUsername } from '@content/extractor';
import { SELECTORS } from '@content/selectors';
import { maybeInjectCommentButton, attachLikesDialogTrigger } from '@content/triggers';
import { openAuditModal } from '@ui/audit-modal';

export default defineContentScript({
  matches: ['https://*.threads.com/*', 'https://*.threads.net/*'],
  runAt: 'document_idle',
  async main() {
    let state: AppState = await loadState();
    const processor = createProcessor(() => state);

    const decorate = (container: HTMLElement) => {
      const u = extractAuthorUsername(container);
      if (!u) return;
      injectBlockButton(container, u, name => {
        openAuditFor([normalizeUsername(name)]);
      });
    };

    const openAuditFor = (usernames: string[]) => {
      if (usernames.length === 0) return;
      const host = document.createElement('div');
      document.body.appendChild(host);
      openAuditModal({
        state, usernames, mountTo: host, useShadow: true,
        onSave: async rows => {
          for (const r of rows) {
            state.blockedUsers[r.username] = {
              username: r.username, tagIds: r.tagIds, note: r.note,
              addedAt: state.blockedUsers[r.username]?.addedAt ?? Date.now(),
              sourceUrl: location.href,
            };
          }
          await saveState(state);
          host.remove();
          processor.reset(document);
        },
        onCancel: () => host.remove(),
      });
    };

    processor.enqueueAll(document);
    document.querySelectorAll<HTMLElement>(SELECTORS.postContainer).forEach(decorate);

    attachObserver(document.body, el => { processor.enqueue(el); decorate(el); });
    let prevEnabled = state.settings.enabled;
    subscribeState(next => {
      const wasEnabled = prevEnabled;
      state = next;
      prevEnabled = next.settings.enabled;
      if (wasEnabled && !next.settings.enabled) {
        processor.restoreAll(document);
      } else {
        processor.reset(document);
      }
    });

    maybeInjectCommentButton(openAuditFor);
    attachLikesDialogTrigger(openAuditFor);
    window.addEventListener('popstate', () => maybeInjectCommentButton(openAuditFor));

    if (state.settings.debugMode) console.log('[block-all] content loaded', state);
  },
});
