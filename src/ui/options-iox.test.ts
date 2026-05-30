import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderIox } from './options-iox';
import { emptyState } from '@core/defaults';

beforeEach(() => { document.body.innerHTML = ''; });

describe('options-iox', () => {
  it('renders export button and import file input', () => {
    renderIox(document.body, emptyState(), vi.fn());
    expect(document.querySelector('#export-btn')).toBeTruthy();
    expect(document.querySelector<HTMLInputElement>('#import-file')!.type).toBe('file');
  });

  it('clicking export creates a download blob', () => {
    const url = vi.fn(() => 'blob:mock');
    (URL.createObjectURL as unknown as typeof url) = url;
    renderIox(document.body, emptyState(), vi.fn());
    document.querySelector<HTMLButtonElement>('#export-btn')!.click();
    expect(url).toHaveBeenCalled();
  });
});
