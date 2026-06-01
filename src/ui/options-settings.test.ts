import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderSettings } from './options-settings';
import { emptyState } from '@core/defaults';

beforeEach(() => { document.body.innerHTML = ''; });

describe('options-settings', () => {
  it('renders three controls', () => {
    renderSettings(document.body, emptyState(), vi.fn());
    expect(document.querySelectorAll('.field').length).toBeGreaterThanOrEqual(3);
  });

  it('changing defaultAction persists state', async () => {
    const s = emptyState();
    const persist = vi.fn().mockResolvedValue(undefined);
    renderSettings(document.body, s, persist);
    const sel = document.querySelector<HTMLSelectElement>('select[name="defaultAction"]')!;
    sel.value = 'hide';
    sel.dispatchEvent(new Event('change'));
    expect(s.settings.defaultAction).toBe('hide');
    expect(persist).toHaveBeenCalled();
  });
});
