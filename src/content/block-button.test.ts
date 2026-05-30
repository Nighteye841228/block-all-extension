import { describe, it, expect, beforeEach, vi } from 'vitest';
import { injectBlockButton } from './block-button';
import { mountFixture } from '../test-utils/fixtures';

beforeEach(() => { document.body.innerHTML = ''; });

describe('injectBlockButton', () => {
  it('adds a button child marked with data-block-all-quick-block', () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    injectBlockButton(container, 'moonowkk', vi.fn());
    expect(container.querySelector('[data-block-all-quick-block]')).toBeTruthy();
  });

  it('clicking the button calls the handler with the username', () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    const onClick = vi.fn();
    injectBlockButton(container, 'moonowkk', onClick);
    container.querySelector<HTMLButtonElement>('[data-block-all-quick-block]')!.click();
    expect(onClick).toHaveBeenCalledWith('moonowkk');
  });

  it('does not double-inject', () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    injectBlockButton(container, 'moonowkk', vi.fn());
    injectBlockButton(container, 'moonowkk', vi.fn());
    expect(container.querySelectorAll('[data-block-all-quick-block]').length).toBe(1);
  });
});
