import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createProcessor } from './observer';
import { mountFixture } from '../test-utils/fixtures';
import { emptyState } from '@core/defaults';
import { HANDLED_ATTR } from './selectors';

beforeEach(() => { document.body.innerHTML = ''; });

describe('observer processor', () => {
  it('processes a container and marks it handled', async () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    const state = emptyState();
    state.blockedUsers['qiyuepie_'] = { username: 'qiyuepie_', tagIds: ['sys:sexism'], note: 'x', addedAt: 0 };

    const onFold = vi.fn();
    const p = createProcessor(() => state, { onFold, onHide: vi.fn() });
    p.enqueue(container);
    await p.flushForTest();

    expect(container.getAttribute(HANDLED_ATTR)).toBe('folded');
    expect(onFold).toHaveBeenCalledTimes(1);
  });

  it('skips already-handled containers', async () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    container.setAttribute(HANDLED_ATTR, 'folded');
    const onFold = vi.fn();
    const p = createProcessor(() => emptyState(), { onFold, onHide: vi.fn() });
    p.enqueue(container);
    await p.flushForTest();
    expect(onFold).not.toHaveBeenCalled();
  });

  it('does nothing when settings.enabled is false', async () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    const state = emptyState();
    state.settings.enabled = false;
    state.blockedUsers['qiyuepie_'] = { username: 'qiyuepie_', tagIds: [], note: '', addedAt: 0 };
    const onFold = vi.fn();
    const p = createProcessor(() => state, { onFold, onHide: vi.fn() });
    p.enqueue(container);
    await p.flushForTest();
    expect(onFold).not.toHaveBeenCalled();
  });
});
