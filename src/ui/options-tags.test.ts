import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderTags } from './options-tags';
import { emptyState } from '@core/defaults';

beforeEach(() => { document.body.innerHTML = ''; });

describe('options-tags', () => {
  it('renders three builtin tags by default', () => {
    renderTags(document.body, emptyState(), vi.fn());
    expect(document.querySelectorAll('.list-row').length).toBe(3);
  });

  it('disables delete on builtin tags', () => {
    renderTags(document.body, emptyState(), vi.fn());
    document.querySelectorAll<HTMLButtonElement>('.list-row .danger').forEach(b => {
      expect(b.disabled).toBe(true);
    });
  });

  it('add tag adds a new custom tag and persists', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const s = emptyState();
    renderTags(document.body, s, persist);
    (document.querySelector('#add-tag') as HTMLButtonElement).click();
    expect(s.tags.length).toBe(4);
    expect(persist).toHaveBeenCalled();
  });
});
