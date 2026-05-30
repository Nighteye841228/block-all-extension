import { describe, it, expect, beforeEach } from 'vitest';
import { foldContainer, unfoldContainer, hideContainer } from './fold-ui';
import { mountFixture } from '../test-utils/fixtures';

beforeEach(() => { document.body.innerHTML = ''; });

describe('fold-ui', () => {
  it('foldContainer wraps original content, marks state, injects banner shadow root', () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    foldContainer(container, {
      username: 'moonowkk',
      tags: [{ name: '性別歧視', color: '#d946ef' }],
      note: '測試備註',
    });
    expect(container.getAttribute('data-block-all-state')).toBe('folded');
    const banner = container.querySelector('[data-block-all-banner]');
    expect(banner?.shadowRoot).toBeTruthy();
    expect(banner!.shadowRoot!.querySelector('.title')?.textContent).toContain('moonowkk');
    expect(container.querySelector('[data-block-all-original]')?.hasAttribute('hidden')).toBe(true);
  });

  it('unfoldContainer restores original visibility', () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    foldContainer(container, { username: 'x', tags: [], note: '' });
    unfoldContainer(container);
    expect(container.getAttribute('data-block-all-state')).toBe('expanded');
    expect(container.querySelector('[data-block-all-original]')?.hasAttribute('hidden')).toBe(false);
  });

  it('hideContainer sets display none and marks handled', () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    hideContainer(container);
    expect(container.style.display).toBe('none');
    expect(container.getAttribute('data-block-all-handled')).toBe('hidden');
  });
});
