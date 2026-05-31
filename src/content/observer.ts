import { AppState } from '@core/types';
import { findBlockedUser, resolveAction } from '@core/matcher';
import { extractAuthorUsername } from './extractor';
import { foldContainer, hideContainer, restoreContainer } from './fold-ui';
import { SELECTORS, HANDLED_ATTR } from './selectors';

export interface ProcessorHooks {
  onFold?: (container: HTMLElement, username: string) => void;
  onHide?: (container: HTMLElement, username: string) => void;
}

const BATCH_SIZE = 50;

export function createProcessor(getState: () => AppState, hooks: ProcessorHooks = {}) {
  const queue = new Set<HTMLElement>();
  let handled = new WeakSet<HTMLElement>();
  let scheduled = false;

  function processOne(container: HTMLElement, state: AppState): void {
    if (handled.has(container) || container.hasAttribute(HANDLED_ATTR)) return;
    const username = extractAuthorUsername(container);
    if (!username) return;
    const user = findBlockedUser(state, username);
    if (!user) return;
    const action = resolveAction(state, user);
    const tags = user.tagIds
      .map(id => state.tags.find(t => t.id === id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map(t => ({ name: t.name, color: t.color }));
    if (action === 'hide') {
      hideContainer(container);
      hooks.onHide?.(container, username);
    } else {
      const sourceUrl = state.settings.showSourceUrlInBanner ? user.sourceUrl : undefined;
      foldContainer(container, { username, tags, note: user.note, sourceUrl });
      hooks.onFold?.(container, username);
    }
    handled.add(container);
  }

  function flush(): void {
    const state = getState();
    if (!state.settings.enabled) {
      queue.clear();
      scheduled = false;
      return;
    }
    let n = 0;
    for (const container of queue) {
      queue.delete(container);
      processOne(container, state);
      if (++n >= BATCH_SIZE) break;
    }
    if (queue.size > 0) schedule();
    else scheduled = false;
  }

  function schedule(): void {
    if (scheduled) return;
    scheduled = true;
    const cb = () => flush();
    if (typeof requestIdleCallback === 'function') requestIdleCallback(cb, { timeout: 100 });
    else requestAnimationFrame(cb);
  }

  return {
    enqueue(container: HTMLElement): void {
      queue.add(container);
      schedule();
    },
    enqueueAll(root: ParentNode): void {
      root.querySelectorAll<HTMLElement>(SELECTORS.postContainer).forEach(el => this.enqueue(el));
    },
    reset(root: ParentNode = document): void {
      handled = new WeakSet<HTMLElement>();
      const state = getState();
      root.querySelectorAll<HTMLElement>(SELECTORS.postContainer).forEach(el => {
        const username = extractAuthorUsername(el);
        const stillBlocked = username ? Boolean(findBlockedUser(state, username)) : false;
        if (el.hasAttribute(HANDLED_ATTR) && !stillBlocked) {
          restoreContainer(el);
          return;
        }
        el.removeAttribute(HANDLED_ATTR);
        this.enqueue(el);
      });
    },
    restoreAll(root: ParentNode = document): void {
      handled = new WeakSet<HTMLElement>();
      queue.clear();
      root.querySelectorAll<HTMLElement>(SELECTORS.postContainer).forEach(el => {
        if (el.hasAttribute(HANDLED_ATTR)) restoreContainer(el);
      });
    },
    flushForTest(): Promise<void> {
      return new Promise(resolve => {
        const drain = () => { flush(); if (queue.size === 0) resolve(); else queueMicrotask(drain); };
        drain();
      });
    },
  };
}

export function attachObserver(target: Node, onMutated: (el: HTMLElement) => void): MutationObserver {
  const observer = new MutationObserver(records => {
    for (const rec of records) {
      for (const node of rec.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches(SELECTORS.postContainer)) onMutated(node);
        node.querySelectorAll<HTMLElement>(SELECTORS.postContainer).forEach(onMutated);
      }
    }
  });
  observer.observe(target, { subtree: true, childList: true });
  return observer;
}
